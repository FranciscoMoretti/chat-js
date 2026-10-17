import { realpath } from "node:fs/promises";
import postgres from "postgres";
import { z } from "zod";
import { env } from "@/lib/env";
import { verifyEveSandboxCoverage } from "./lifecycle/postgres/eve-sandbox-coverage-proof";
import { assertEveConfigured } from "./server";

const resourceReceipt = z.strictObject({
  appRoot: z.string(),
  sessionId: z.string(),
  retired: z.literal(true),
  remaining: z.number().int().nonnegative(),
});

/**
 * Worker-authoritative local resource operation, after native and app retirement.
 * @param {string} ownerId Authorized deleting owner.
 * @param {string} appRoot Expected canonical worker root, never a cache selector.
 * @param {{ sessionId: string; rootSessionId: string }} scope Fenced native descendant and its deleting app binding.
 * @param {"retire" | "purge"} action Retirement or exact owned resource removal.
 * @param {boolean} releaseForkSnapshots Whether the worker must also check app retention before releasing snapshots.
 * @returns {Promise<number>} Remaining retained resources; unknown operations reject.
 */
export const manageEveLocalResources = async (
  ownerId: string,
  appRoot: string,
  scope: { readonly sessionId: string; readonly rootSessionId: string },
  action: "retire" | "purge",
  releaseForkSnapshots: boolean
): Promise<number> => {
  const response = await fetch(
    new URL(
      `/eve/chat/v1/session/${encodeURIComponent(scope.sessionId)}/local-resources`,
      env.EVE_INTERNAL_ORIGIN
    ),
    {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      headers: {
        authorization: `Bearer ${env.EVE_GATEWAY_SECRET}`,
        "content-type": "application/json",
        "x-chatjs-deletion": "1",
        "x-chatjs-deletion-root": scope.rootSessionId,
        "x-chatjs-owner": ownerId,
      },
      body: JSON.stringify({
        expectedAppRoot: appRoot,
        action,
        releaseForkSnapshots,
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );
  if (!response.ok) {
    throw new Error("Local sandbox resource cleanup is unconfirmed.");
  }
  const receipt = resourceReceipt.parse(await response.json());
  if (receipt.appRoot !== appRoot || receipt.sessionId !== scope.sessionId) {
    throw new Error("Local sandbox cleanup authority mismatch.");
  }
  return receipt.remaining;
};

/**
 * Cover every sandbox-owning native session and retire it in the actual worker.
 * @param {string} ownerId Owner of the deleting family.
 * @param {string} appRoot Expected worker application root.
 * @param {readonly { sessionId: string; runIds: readonly string[] }[]} inventories Complete native inventories retained under writer fences.
 * @returns {Promise<{ appRoot: string; sessions: { sessionId: string; rootSessionId: string }[] }>} Exact worker scope for subsequent removal; incomplete coverage rejects.
 */
export const verifyLocalEveFamilyCoverage = async (
  ownerId: string,
  appRoot: string,
  inventories: readonly {
    readonly sessionId: string;
    readonly runIds: readonly string[];
  }[]
): Promise<{
  appRoot: string;
  sessions: { sessionId: string; rootSessionId: string }[];
}> => {
  assertEveConfigured();
  const canonicalRoot = await realpath(appRoot);
  const connection = postgres(env.WORKFLOW_POSTGRES_URL ?? "", { max: 1 });
  const sessions: { sessionId: string; rootSessionId: string }[] = [];
  try {
    for (const inventory of inventories) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each proof owns a transaction on the single native connection.
      const ids = await verifyEveSandboxCoverage(
        connection,
        { ...inventory, appRoot: canonicalRoot },
        async (sessionId) => {
          await manageEveLocalResources(
            ownerId,
            canonicalRoot,
            { sessionId, rootSessionId: inventory.sessionId },
            "retire",
            false
          );
        }
      );
      for (const sessionId of ids) {
        sessions.push({ sessionId, rootSessionId: inventory.sessionId });
      }
    }
    // Saved workflow coverage does not replace a current worker/cache check.
    for (const scope of sessions) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Serialize local owner locks and finish all retirement before removal.
      await manageEveLocalResources(
        ownerId,
        canonicalRoot,
        scope,
        "retire",
        false
      );
    }
    return { appRoot: canonicalRoot, sessions };
  } finally {
    await connection.end();
  }
};
