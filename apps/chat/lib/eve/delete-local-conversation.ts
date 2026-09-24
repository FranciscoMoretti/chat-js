import { completeEveConversationDeletion } from "../db/eve-deletion";
import { purgeEveNativeSession } from "../db/eve-native-purge";
import { env } from "../env";
import { purgeLocalEveFamilyResources } from "./purge-local-resources";
import { retireEveSessionForDeletion } from "./retire-session";

/** Internal local-provider entry point. appRoot is the trusted worker root, never user input. */
export const deleteLocalEveConversationFamily = async (
  ownerId: string,
  conversationId: string,
  appRoot: string
) => {
  const databaseUrl = env.WORKFLOW_POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("EVE Postgres is not configured.");
  }
  // Retirement receipts make this replayable even after some native payloads were erased.
  const family = await purgeLocalEveFamilyResources(
    ownerId,
    conversationId,
    appRoot
  );
  if (!family) {
    return;
  }
  for (const conversation of family.conversations) {
    if (!conversation.sessionId) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    const { sessionId } = conversation;
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    await purgeEveNativeSession(
      databaseUrl,
      { sessionId, taskIdentifier: "workflow_flows" },
      async () => {
        await retireEveSessionForDeletion(ownerId, sessionId);
      }
    );
  }
  await completeEveConversationDeletion(ownerId, family.rootId);
  return { rootId: family.rootId };
};
