import { prepareEveNativeSessionPurge } from "../db/eve-native-purge";
import { env } from "../env";
import {
  retireEveFamilyForDeletion,
  retireEveSessionForDeletion,
} from "./retire-session";
import { resolveWorkflowWorld } from "./world-config";

/** Authorize and retire the whole family before fencing work for external-resource inventory. */
export const prepareEveFamilyDeletion = async (
  ownerId: string,
  conversationId: string
) => {
  const family = await retireEveFamilyForDeletion(ownerId, conversationId);
  if (!family) {
    return;
  }
  const databaseUrl = env.WORKFLOW_POSTGRES_URL;
  if (
    resolveWorkflowWorld(env) !== "@workflow/world-postgres" ||
    !databaseUrl
  ) {
    throw new Error(
      "This deletion operation requires the PostgreSQL workflow backend."
    );
  }
  const nativeInventories: {
    sessionId: string;
    runIds: string[];
    streamIds: string[];
  }[] = [];
  const runIds = new Set<string>();
  const streamIds = new Set<string>();
  for (const conversation of family.conversations) {
    const { sessionId } = conversation;
    if (!sessionId) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
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
    runIds: [...runIds].toSorted(),
    streamIds: [...streamIds].toSorted(),
  };
};
