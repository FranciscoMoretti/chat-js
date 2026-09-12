import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import postgres from "postgres";
import { z } from "zod";
import { verifyEveSandboxCoverage } from "../db/eve-sandbox-coverage-proof";
import { env } from "../env";
import { assertEveConfigured } from "./server";

const identitySchema = z.strictObject({
  version: z.literal(1),
  sessionId: z.string().min(1),
  appRoot: z.string().min(1),
  backendName: z.literal("microsandbox"),
});
const receiptSchema = z.strictObject({
  version: z.literal(1),
  snapshotVersion: z.literal(2),
  sessionId: z.string().min(1),
  local: identitySchema,
});

/** Called only after family authorization, retirement and native/local fences. */
export async function verifyLocalEveFamilyCoverage(
  ownerId: string,
  appRoot: string,
  inventories: Array<{ sessionId: string; runIds: string[] }>
) {
  assertEveConfigured();
  const canonicalRoot = await realpath(appRoot);
  const connection = postgres(env.WORKFLOW_POSTGRES_URL ?? "", { max: 1 });
  try {
    for (const inventory of inventories) {
      await verifyEveSandboxCoverage(
        connection,
        { ...inventory, appRoot: canonicalRoot },
        async (sessionId) => {
          const response = await fetch(
            new URL(
              `/eve/v1/session/${encodeURIComponent(sessionId)}/sandbox-identity`,
              env.EVE_INTERNAL_ORIGIN
            ),
            {
              headers: {
                authorization: `Bearer ${env.EVE_GATEWAY_SECRET}`,
                "x-chatjs-owner": ownerId,
                "x-chatjs-deletion": "1",
                "x-chatjs-deletion-root": inventory.sessionId,
              },
              redirect: "error",
              cache: "no-store",
              signal: AbortSignal.timeout(15_000),
            }
          );
          if (!response.ok) {
            throw new Error(
              "Native sandbox ownership evidence is unavailable."
            );
          }
          const receipt = receiptSchema.parse(await response.json());
          const expected = {
            version: 1,
            sessionId,
            appRoot: canonicalRoot,
            backendName: "microsandbox",
          };
          if (
            receipt.sessionId !== sessionId ||
            !isDeepStrictEqual(receipt.local, expected)
          ) {
            throw new Error(
              "Native sandbox ownership does not match this worker."
            );
          }
          const directory = join(canonicalRoot, ".eve", "sandbox-identities");
          if ((await realpath(directory)) !== directory) {
            throw new Error(
              "Sandbox identity directory must not be redirected."
            );
          }
          const file = await open(
            join(
              directory,
              `${createHash("sha256").update(sessionId).digest("hex")}.json`
            ),
            constants.O_NOFOLLOW
          );
          try {
            const stat = await file.stat();
            if (!stat.isFile() || stat.size > 16_384) {
              throw new Error("Invalid sandbox identity file.");
            }
            const local = identitySchema.parse(
              JSON.parse(await file.readFile("utf8"))
            );
            if (!isDeepStrictEqual(local, expected)) {
              throw new Error(
                "Local sandbox ownership does not match native evidence."
              );
            }
          } finally {
            await file.close();
          }
        }
      );
    }
  } finally {
    await connection.end();
  }
}
