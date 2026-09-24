import { rejectUnacceptedEveCopy } from "../db/eve-copy-dispatch";
import {
  completeEveConversationDeletion,
  getEveDeletionState,
} from "../db/eve-deletion";
import { purgeEveFamilyDocuments } from "../db/eve-documents";
import { purgeEveFamilyFiles } from "./purge-files";

/** Never-dispatched proof replaces native retirement; accepted copies cannot enter this path. */
export const deleteUnacceptedEveCopy = async (
  ownerId: string,
  conversationId: string
) => {
  const deletion = await getEveDeletionState(ownerId, conversationId);
  if (!deletion) {
    throw new Error("Conversation identity is unavailable.");
  }
  if (deletion.state === "deleted") {
    return;
  }
  try {
    await rejectUnacceptedEveCopy(ownerId, conversationId);
    await purgeEveFamilyDocuments(ownerId, deletion.rootId);
    await purgeEveFamilyFiles(ownerId, deletion.rootId);
    await completeEveConversationDeletion(ownerId, conversationId);
  } catch (error) {
    // A concurrent cleanup may have completed while this caller waited on the family lock.
    const current = await getEveDeletionState(ownerId, conversationId);
    if (current?.state !== "deleted") {
      throw error;
    }
  }
};
