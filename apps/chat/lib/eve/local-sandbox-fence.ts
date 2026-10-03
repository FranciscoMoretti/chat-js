/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; import { mkdir, readdir, writeFile } from "node:fs/promises";; import nodePath from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import nodePath from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable jsdoc/require-param, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): fenceLocalEveSandboxMutations's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): fenceLocalEveSandboxMutations uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): fenceLocalEveSandboxMutations accepts sessionIds: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Permanently stop new local sandbox operations for an authorized native family.
 * Existing operation records must disappear before inventory and cleanup proceed.
 * Never expire or discard unresolved records on a timer: provider work may remain.
 */
export const fenceLocalEveSandboxMutations = async (
  appRoot: string,
  sessionIds: string[]
): Promise<void> => {
  const scopes = [...new Set(sessionIds)].map((id) =>
    nodePath.join(
      appRoot,
      ".eve",
      "sandbox-mutations",
      createHash("sha256").update(id).digest("hex")
    )
  );
  for (const scope of scopes) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    await mkdir(scope, { recursive: true });
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    await writeFile(nodePath.join(scope, "deleted"), "1\n", {
      flag: "wx",
      mode: 0o600,
    }).catch((error: unknown) => {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      ) {
        throw error;
      }
    });
  }
  for (const scope of scopes) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    const operations = await readdir(nodePath.join(scope, "operations")).catch(
      (error: unknown) => {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return [];
        }
        throw error;
      }
    );
    if (operations.length > 0) {
      throw new Error(
        "Sandbox operations are still pending. Resolve them before cleanup."
      );
    }
  }
};
/* oxlint-enable jsdoc/require-param, no-magic-numbers, typescript/prefer-readonly-parameter-types */
