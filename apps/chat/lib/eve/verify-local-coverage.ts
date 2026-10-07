/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; import { constants } from "node:fs";; import { open, realpath } from "node:fs/promises";; import nodePath from "node:path";; import { isDeepStrictEqual } from "node:util";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { constants } from "node:fs";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { open, realpath } from "node:fs/promises";
/* oxlint-enable sort-imports */
import nodePath from "node:path";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { isDeepStrictEqual } from "node:util";
/* oxlint-enable sort-imports */

import postgres from "postgres";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
import { verifyEveSandboxCoverage } from "@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveConfigured } from "./server";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): identitySchema uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const identitySchema = z.strictObject({
  appRoot: z.string().min(1),
  backendName: z.literal("microsandbox"),
  sessionId: z.string().min(1),
  version: z.literal(1),
});
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): receiptSchema uses 1, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const receiptSchema = z.strictObject({
  local: identitySchema,
  sessionId: z.string().min(1),
  snapshotVersion: z.literal(2),
  version: z.literal(1),
});
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (verifyLocalEveFamilyCoverage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve verifyLocalEveFamilyCoverage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * max-lines-per-function (#510): verifyLocalEveFamilyCoverage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): verifyLocalEveFamilyCoverage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): verifyLocalEveFamilyCoverage uses 15_000, 16_384 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): verifyLocalEveFamilyCoverage accepts inventories: { sessionId: string; runIds: string[]; }[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Verify native and local sandbox identity evidence for every retired family inventory.
 * Call only after family authorization, retirement and native/local fences.
 * @param {string} ownerId - Authorized family owner sent with native deletion-evidence requests.
 * @param {string} appRoot - Worker application root, canonicalized before comparing identity receipts.
 * @param {{ sessionId: string; runIds: string[]; }[]} inventories - Session roots and run IDs whose sandbox coverage must be proven.
 */
export const verifyLocalEveFamilyCoverage = async (
  ownerId: string,
  appRoot: string,
  inventories: {
    sessionId: string;
    runIds: string[];
  }[]
): Promise<void> => {
  assertEveConfigured();
  const canonicalRoot = await realpath(appRoot);
  const connection = postgres(env.WORKFLOW_POSTGRES_URL ?? "", { max: 1 });
  try {
    for (const inventory of inventories) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
      await verifyEveSandboxCoverage(
        connection,
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing inventory own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        { ...inventory, appRoot: canonicalRoot },
        async (sessionId) => {
          const response = await fetch(
            new URL(
              `/eve/chat/v1/session/${encodeURIComponent(sessionId)}/sandbox-identity`,
              env.EVE_INTERNAL_ORIGIN
            ),
            {
              cache: "no-store",
              headers: {
                authorization: `Bearer ${env.EVE_GATEWAY_SECRET}`,
                "x-chatjs-deletion": "1",
                "x-chatjs-deletion-root": inventory.sessionId,
                "x-chatjs-owner": ownerId,
              },
              redirect: "error",
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
            appRoot: canonicalRoot,
            backendName: "microsandbox",
            sessionId,
            version: 1,
          };
          if (
            receipt.sessionId !== sessionId ||
            !isDeepStrictEqual(receipt.local, expected)
          ) {
            throw new Error(
              "Native sandbox ownership does not match this worker."
            );
          }
          const directory = nodePath.join(
            canonicalRoot,
            ".eve",
            "sandbox-identities"
          );
          if ((await realpath(directory)) !== directory) {
            throw new Error(
              "Sandbox identity directory must not be redirected."
            );
          }
          const file = await open(
            nodePath.join(
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
              JSON.parse(await file.readFile("utf-8"))
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
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */
