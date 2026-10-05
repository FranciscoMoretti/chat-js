import { rejectUnacceptedEveCopy } from "@/lib/db/eve-copy-dispatch";
import {
  completeEveConversationDeletion,
  getEveDeletionState,
} from "@/lib/db/eve-deletion";
import { purgeEveFamilyDocuments } from "@/lib/db/eve-documents";

import { purgeEveFamilyFiles } from "./purge-files";

/* oxlint-disable jsdoc/require-param, max-statements --
 * jsdoc/require-param (#534): deleteUnacceptedEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): deleteUnacceptedEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/** Never-dispatched proof replaces native retirement; accepted copies cannot enter this path. */
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
/* oxlint-enable jsdoc/require-param, max-statements */
