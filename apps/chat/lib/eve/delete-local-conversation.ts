import { isNonEmptyString } from "@/lib/is-non-empty-string";

import { completeEveConversationDeletion } from "@/lib/db/eve-deletion";

import { purgeLocalEveFamilyResources } from "./purge-local-resources";
import { requireEveDeletionLifecycle } from "./deletion-lifecycle";
import { retireEveSessionForDeletion } from "./retire-session";

const purgeConversationSessions = async (
  ownerId: string,
  conversations: readonly NonNullable<
    Awaited<ReturnType<typeof purgeLocalEveFamilyResources>>
  >["conversations"][number][],
  lifecycle: Readonly<
    Pick<ReturnType<typeof requireEveDeletionLifecycle>, "purge">
  >
): Promise<void> => {
  for (const conversation of conversations) {
    if (!isNonEmptyString(conversation.sessionId)) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    const { sessionId } = conversation;
    // oxlint-disable-next-line eslint/no-await-in-loop -- Use one dedicated two-connection native purge pool at a time; sibling sessions can overlap descendant resources, and every purge must finish before deletion completes.
    await lifecycle.purge(sessionId, async () => {
      await retireEveSessionForDeletion(ownerId, sessionId);
    });
  }
};

/** Purge an owner-authorized local conversation family and complete its deletion.
 * @param {string} ownerId Owner whose conversation family and sessions may be retired.
 * @param {string} conversationId Conversation used to resolve the deletion family.
 * @param {string} appRoot Trusted worker root for local resources, never user input.
 * @returns {Promise<{ rootId: string } | undefined>} Root identity after native session purges and deletion completion, or no result when the resource purge finds no family. Rejects on missing session bindings or cleanup failure.
 */
export const deleteLocalEveConversationFamily = async (
  ownerId: string,
  conversationId: string,
  appRoot: string
): Promise<{ rootId: string } | undefined> => {
  const lifecycle = requireEveDeletionLifecycle();
  // Retirement receipts make this replayable even after some native payloads were erased.
  const family = await purgeLocalEveFamilyResources(
    ownerId,
    conversationId,
    appRoot
  );
  if (!family) {
    return undefined;
  }
  await purgeConversationSessions(ownerId, family.conversations, lifecycle);
  await completeEveConversationDeletion(ownerId, family.rootId);
  return { rootId: family.rootId };
};
