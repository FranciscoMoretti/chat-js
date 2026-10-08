/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; import { mkdir, readdir, writeFile } from "node:fs/promises";; import nodePath from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import nodePath from "node:path";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (fenceLocalEveSandboxMutations); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fenceLocalEveSandboxMutations's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */

/**
 * Permanently stop new local sandbox operations for an authorized native family.
 * Existing operation records must disappear before inventory and cleanup proceed.
 * Never expire or discard unresolved records on a timer: provider work may remain.
 * @param {string} appRoot - Application root containing the local .eve mutation journal.
 * @param {readonly string[]} sessionIds - Authorized family members to fence; duplicates share one marker.
 */
export const fenceLocalEveSandboxMutations = async (
  appRoot: string,
  sessionIds: readonly string[]
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
    // oxlint-disable-next-line no-magic-numbers -- Zero journal entries means every recorded sandbox operation has settled.
    if (operations.length > 0) {
      throw new Error(
        "Sandbox operations are still pending. Resolve them before cleanup."
      );
    }
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
