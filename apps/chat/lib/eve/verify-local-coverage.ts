import { getPersistentSandboxProvider } from "../sandbox/runtime";
import {
  readPersistentIdentity,
  resolvePersistentIdentity,
  retirePersistentSession,
  cleanupPersistentSession,
} from "./persistent-sandbox-store";
import { realpath } from "node:fs/promises";
import postgres from "postgres";
import { env } from "@/lib/env";
import { verifyEveSandboxCoverage } from "./lifecycle/postgres/eve-sandbox-coverage-proof";
import { assertEveConfigured } from "./server";

/** Retire or delete the exact app-owned resources after native writer fencing. */
export const manageEveLocalResources = async (
  ownerId: string,
  scope: { readonly sessionId: string; readonly rootSessionId: string },
  action: "retire" | "purge"
): Promise<void> => {
  const saved = await readPersistentIdentity(scope.sessionId);
  const identity =
    saved ?? (await resolvePersistentIdentity({ ...scope, ownerId }));
  if (
    identity.ownerId !== ownerId ||
    identity.rootSessionId !== scope.rootSessionId
  ) {
    throw new Error("App-owned persistent sandbox coverage is unavailable.");
  }
  await retirePersistentSession(identity);
  if (action === "purge") {
    await cleanupPersistentSession(identity, getPersistentSandboxProvider);
  }
};

/**
 * Cover every sandbox-owning native session and retire its app-owned resources.
 * @param {string} ownerId Owner of the deleting family.
 * @param {string} appRoot Expected worker application root.
 * @param {readonly { sessionId: string; runIds: readonly string[] }[]} inventories Complete native inventories retained under writer fences.
 * @returns {Promise<{ appRoot: string; sessions: { sessionId: string; rootSessionId: string }[] }>} Verified session inventory for subsequent removal; incomplete coverage rejects.
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
            { sessionId, rootSessionId: inventory.sessionId },
            "retire"
          );
        }
      );
      for (const sessionId of ids) {
        sessions.push({ sessionId, rootSessionId: inventory.sessionId });
      }
    }
    // Retained workflow coverage does not replace current app ownership checks.
    for (const scope of sessions) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Serialize local owner locks and finish all retirement before removal.
      await manageEveLocalResources(ownerId, scope, "retire");
    }
    return { appRoot: canonicalRoot, sessions };
  } finally {
    await connection.end();
  }
};
