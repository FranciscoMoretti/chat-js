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
  const resolvedResult1 = await getEveDeletionState(ownerId, conversationId);
  if (resolvedResult1?.state === "deleted") {
    return;
  }
  try {
    await rejectUnacceptedEveCopy(ownerId, conversationId);
    await purgeEveFamilyDocuments(ownerId, conversationId);
    await purgeEveFamilyFiles(ownerId, conversationId);
    await completeEveConversationDeletion(ownerId, conversationId);
  } catch (error) {
    // A concurrent cleanup may have completed while this caller waited on the family lock.
    const resolvedResult2 = await getEveDeletionState(ownerId, conversationId);
    if (resolvedResult2?.state !== "deleted") {
      throw error;
    }
  }
};
