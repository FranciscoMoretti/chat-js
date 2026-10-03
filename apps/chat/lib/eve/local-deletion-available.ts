/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../env" dependency within this package instead of introducing an alias or barrel API.
 */
import { env } from "../env";
import { resolveWorkflowWorld } from "./world-config";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named localDeletionAvailable API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): localDeletionAvailable remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
export const localDeletionAvailable = (): boolean => {
  if (resolveWorkflowWorld(env) === "vercel") {
    return false;
  }
  try {
    const local = new Set(["localhost", "127.0.0.1", "[::1]"]);
    const world = new URL(env.WORKFLOW_POSTGRES_URL ?? "");
    const worker = new URL(env.EVE_INTERNAL_ORIGIN ?? "");
    return (
      ["postgres:", "postgresql:"].includes(world.protocol) &&
      local.has(world.hostname) &&
      ["http:", "https:"].includes(worker.protocol) &&
      local.has(worker.hostname)
    );
  } catch {
    return false;
  }
};
/* oxlint-enable import/no-named-export, import/prefer-default-export */
