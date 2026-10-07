import { completeEveConversationDeletion } from "@/lib/db/eve-deletion";

import { requireEveDeletionLifecycle } from "./deletion-lifecycle";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { purgeLocalEveFamilyResources } from "./purge-local-resources";
/* oxlint-enable sort-imports */
import { retireEveSessionForDeletion } from "./retire-session";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (deleteLocalEveConversationFamily); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteLocalEveConversationFamily's awaited sequencing and rejected-Promise behavior. */
/** Purge an owner-authorized local conversation family and complete its deletion.
 * @param {string} ownerId Owner whose conversation family and sessions may be retired.
 * @param {string} conversationId Conversation used to resolve the deletion family.
 * @param {string} appRoot Trusted worker root for local resources, never user input.
 * @returns {Promise<{ rootId: string } | undefined>} Root identity after native session purges and deletion completion, or no result when the resource purge finds no family. Rejects on missing session bindings or cleanup failure.
 */
// oxlint-disable-next-line max-statements -- These 11 statements validate lifecycle availability before resource cleanup, preserve the session binding across the awaited purge/retirement callback, and complete the tombstone only after every purge succeeds.
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
  for (const conversation of family.conversations) {
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- Reject a missing or empty native session binding before purge; preserve this getter read followed by the separate validated sessionId read.
    if (!conversation.sessionId) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    const { sessionId } = conversation;
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    await lifecycle.purge(sessionId, async () => {
      await retireEveSessionForDeletion(ownerId, sessionId);
    });
  }
  await completeEveConversationDeletion(ownerId, family.rootId);
  // oxlint-disable-next-line typescript/consistent-return -- A missing resource family returns without a value; a completed family returns its root identity. Preserve this optional result instead of fabricating a root or changing the absence sentinel.
  return { rootId: family.rootId };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
