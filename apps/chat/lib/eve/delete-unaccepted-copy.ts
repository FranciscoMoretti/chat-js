import { rejectUnacceptedEveCopy } from "@/lib/db/eve-copy-dispatch";
import {
  completeEveConversationDeletion,
  getEveDeletionState,
} from "@/lib/db/eve-deletion";
import { purgeEveFamilyDocuments } from "@/lib/db/eve-documents";

import { purgeEveFamilyFiles } from "./purge-files";

const purgeUnacceptedEveCopy = async (
  ownerId: string,
  conversationId: string,
  deletion: Readonly<
    NonNullable<Awaited<ReturnType<typeof getEveDeletionState>>>
  >
): Promise<void> => {
  await rejectUnacceptedEveCopy(ownerId, conversationId);
  await purgeEveFamilyDocuments(ownerId, deletion.rootId);
  await purgeEveFamilyFiles(ownerId, deletion.rootId);
  await completeEveConversationDeletion(ownerId, conversationId);
};

/** Never-dispatched proof replaces native retirement; accepted copies cannot enter this path.
 * @param {string} ownerId Owner authorizing removal of the undispatched copy.
 * @param {string} conversationId Copy identity checked for deletion state and never-accepted dispatch proof.
 * @returns {Promise<void>} Completes document/file cleanup and the deletion tombstone, or succeeds when a concurrent cleanup already completed. Missing identities, accepted dispatches and unresolved cleanup failures reject.
 */
export const deleteUnacceptedEveCopy = async (
  ownerId: string,
  conversationId: string
): Promise<void> => {
  const deletion = await getEveDeletionState(ownerId, conversationId);
  if (!deletion) {
    throw new Error("Conversation identity is unavailable.");
  }
  if (deletion.state === "deleted") {
    return;
  }
  try {
    await purgeUnacceptedEveCopy(ownerId, conversationId, deletion);
  } catch (error) {
    // A concurrent cleanup may have completed while this caller waited on the family lock.
    const current = await getEveDeletionState(ownerId, conversationId);
    if (current?.state !== "deleted") {
      throw error;
    }
  }
};
