import { env } from "../env";
import { resolveWorkflowWorld } from "./world-config";

/** Optional optimization. Unknown positions must still be reconciled through Eve's stream. */
export const getEveStreamPositions = async (sessionIds: string[]) => {
  if (resolveWorkflowWorld(env) === "vercel" || sessionIds.length === 0) {
    return new Map<string, number>();
  }
  if (!env.WORKFLOW_POSTGRES_URL) {
    throw new Error("Configure WORKFLOW_POSTGRES_URL for local workflows.");
  }
  const { getEvePostgresStreamPositions } =
    await import("../db/eve-stream-positions");
  return await getEvePostgresStreamPositions(
    env.WORKFLOW_POSTGRES_URL,
    sessionIds
  );
};
