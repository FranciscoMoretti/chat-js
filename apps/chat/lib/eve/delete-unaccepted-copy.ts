/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-copy-dispatch"; "../db/eve-deletion"; "../db/eve-documents" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { rejectUnacceptedEveCopy } from "../db/eve-copy-dispatch";
import {
  completeEveConversationDeletion,
  getEveDeletionState,
} from "../db/eve-deletion";
import { purgeEveFamilyDocuments } from "../db/eve-documents";
import { purgeEveFamilyFiles } from "./purge-files";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, max-statements  --
 * import/no-named-export (#527): Preserve the named deleteUnacceptedEveCopy API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): deleteUnacceptedEveCopy remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): deleteUnacceptedEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): deleteUnacceptedEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): deleteUnacceptedEveCopy sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): deleteUnacceptedEveCopy handles optional current?.state without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
