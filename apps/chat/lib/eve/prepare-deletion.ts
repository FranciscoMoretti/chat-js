import { prepareEveNativeSessionPurge } from "../db/eve-native-purge";
import { env } from "../env";
import {
  retireEveFamilyForDeletion,
  retireEveSessionForDeletion,
} from "./retire-session";

/** Authorize and retire the whole family before fencing work for external-resource inventory. */
export async function prepareEveFamilyDeletion(
  ownerId: string,
  conversationId: string
) {
  const family = await retireEveFamilyForDeletion(ownerId, conversationId);
  if (!family) {
    return undefined;
  }
  const databaseUrl = env.WORKFLOW_POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("EVE Postgres is not configured.");
  }
  const nativeInventories: Array<{
    sessionId: string;
    runIds: string[];
    streamIds: string[];
  }> = [];
  const runIds = new Set<string>();
  const streamIds = new Set<string>();
  for (const conversation of family.conversations) {
    const sessionId = conversation.sessionId;
    if (!sessionId) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    const inventory = await prepareEveNativeSessionPurge(
      databaseUrl,
      { sessionId, taskIdentifier: "workflow_flows" },
      async () => {
        await retireEveSessionForDeletion(ownerId, sessionId);
      }
    );
    nativeInventories.push({ sessionId, ...inventory });
    for (const id of inventory.runIds) {
      runIds.add(id);
    }
    for (const id of inventory.streamIds) {
      streamIds.add(id);
    }
  }
  return {
    ...family,
    nativeInventories,
    runIds: [...runIds].sort(),
    streamIds: [...streamIds].sort(),
  };
}
