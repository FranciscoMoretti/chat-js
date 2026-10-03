/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../env" dependency within this package instead of introducing an alias or barrel API.
 */
import { env } from "../env";
import { resolveWorkflowWorld } from "./world-config";
/* oxlint-enable import/no-relative-parent-imports */

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
