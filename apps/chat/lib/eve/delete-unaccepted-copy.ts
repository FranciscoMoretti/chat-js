import { rejectUnacceptedEveCopy } from "@/lib/db/eve-copy-dispatch";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  completeEveConversationDeletion,
  getEveDeletionState,
} from "@/lib/db/eve-deletion";
/* oxlint-enable sort-imports */
import { purgeEveFamilyDocuments } from "@/lib/db/eve-documents";

import { purgeEveFamilyFiles } from "./purge-files";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (deleteUnacceptedEveCopy); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteUnacceptedEveCopy's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, max-statements */
