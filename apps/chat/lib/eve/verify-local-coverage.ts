/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; import { constants } from "node:fs";; import { open, realpath } from "node:fs/promises";; import nodePath from "node:path";; import { isDeepStrictEqual } from "node:util";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof"; "../env" dependency within this package instead of introducing an alias or barrel API.
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import nodePath from "node:path";
import { isDeepStrictEqual } from "node:util";

import postgres from "postgres";
import { z } from "zod";

import { verifyEveSandboxCoverage } from "@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof";

import { env } from "../env";
import { assertEveConfigured } from "./server";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

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
/* oxlint-enable no-magic-numbers */

/* oxlint-disable jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): verifyLocalEveFamilyCoverage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): verifyLocalEveFamilyCoverage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): verifyLocalEveFamilyCoverage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): verifyLocalEveFamilyCoverage uses 15_000, 16_384 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): verifyLocalEveFamilyCoverage accepts inventories: { sessionId: string; runIds: string[]; }[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Called only after family authorization, retirement and native/local fences. */
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
/* oxlint-enable jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */
