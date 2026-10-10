import { completeEveConversationDeletion } from "@/lib/db/eve-deletion";

import { purgeLocalEveFamilyResources } from "./purge-local-resources";
import { requireEveDeletionLifecycle } from "./deletion-lifecycle";
import { retireEveSessionForDeletion } from "./retire-session";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (deleteLocalEveConversationFamily); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteLocalEveConversationFamily's awaited sequencing and rejected-Promise behavior. */
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
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- Preserve the original nullable session guard and separate later sessionId read while narrowing the original conversation.
    if (!conversation.sessionId) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    const { sessionId } = conversation;
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
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
    return;
  }
  await purgeConversationSessions(ownerId, family.conversations, lifecycle);
  await completeEveConversationDeletion(ownerId, family.rootId);
  // oxlint-disable-next-line typescript/consistent-return -- A missing resource family returns without a value; a completed family returns its root identity. Preserve this optional result instead of fabricating a root or changing the absence sentinel.
  return { rootId: family.rootId };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
