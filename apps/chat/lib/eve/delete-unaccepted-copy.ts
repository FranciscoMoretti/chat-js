import { rejectUnacceptedEveCopy } from "@/lib/db/eve-copy-dispatch";
/* oxlint-disable sort-imports -- Load the copy-journal Eve transcript dependency before deletion response-group schemas; Eve's compiled Zod installs a shared postProcessor that affects later external-Zod schema construction. */
import {
  completeEveConversationDeletion,
  getEveDeletionState,
} from "@/lib/db/eve-deletion";
/* oxlint-enable sort-imports */
import { purgeEveFamilyDocuments } from "@/lib/db/eve-documents";

import { purgeEveFamilyFiles } from "./purge-files";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (deleteUnacceptedEveCopy); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteUnacceptedEveCopy's awaited sequencing and rejected-Promise behavior. */
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading state from current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (current?.state !== "deleted") {
      throw error;
    }
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
