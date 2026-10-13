import { env } from "@/lib/env";

import { resolveWorkflowWorld } from "./world-config";

/** Optional optimization. Unknown positions must still be reconciled through Eve's stream.
 * @param {readonly string[]} sessionIds Owner-authorized native session identities whose persisted stream positions are requested.
 * @returns {Promise<Map<string, number>>} Known persisted positions, or an empty map for the managed world/empty input; absent streams still require native reconciliation.
 */
export const getEveStreamPositions = async (
  sessionIds: readonly string[]
): Promise<Map<string, number>> => {
  if (resolveWorkflowWorld(env) === "vercel" || sessionIds.length === 0) {
    return new Map<string, number>();
  }
  if (
    typeof env.WORKFLOW_POSTGRES_URL !== "string" ||
    env.WORKFLOW_POSTGRES_URL === ""
  ) {
    throw new Error("Configure WORKFLOW_POSTGRES_URL for local workflows.");
  }
  const { getEvePostgresStreamPositions } =
    await import("@/lib/eve/lifecycle/postgres/eve-stream-positions");
  return await getEvePostgresStreamPositions(
    env.WORKFLOW_POSTGRES_URL,
    sessionIds
  );
};
