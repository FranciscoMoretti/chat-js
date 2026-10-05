import { env } from "@/lib/env";

import { resolveWorkflowWorld } from "./world-config";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getEveStreamPositions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveStreamPositions's awaited sequencing and rejected-Promise behavior. */

/** Optional optimization. Unknown positions must still be reconciled through Eve's stream.
 * @param {readonly string[]} sessionIds Owner-authorized native session identities whose persisted stream positions are requested.
 * @returns {Promise<Map<string, number>>} Known persisted positions, or an empty map for the managed world/empty input; absent streams still require native reconciliation.
 */
export const getEveStreamPositions = async (
  sessionIds: readonly string[]
): Promise<Map<string, number>> => {
  // oxlint-disable-next-line no-magic-numbers -- Empty authorized input or the managed world returns no local position evidence.
  if (resolveWorkflowWorld(env) === "vercel" || sessionIds.length === 0) {
    return new Map<string, number>();
  }
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- Missing or empty local workflow URL must reject before loading the PostgreSQL adapter.
  if (!env.WORKFLOW_POSTGRES_URL) {
    throw new Error("Configure WORKFLOW_POSTGRES_URL for local workflows.");
  }
  const { getEvePostgresStreamPositions } =
    await import("@/lib/eve/lifecycle/postgres/eve-stream-positions");
  return await getEvePostgresStreamPositions(
    env.WORKFLOW_POSTGRES_URL,
    sessionIds
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
