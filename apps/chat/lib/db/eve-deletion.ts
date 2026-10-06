import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "./client";
import { tombstoneEveResponseGroups } from "./eve-response-groups";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveChat,
  eveChatProject,
  eveCodeSandbox,
  eveConversation,
  eveConversationCopy,
  eveConversationCopyFile,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveFileReference,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
  eveNamedDocumentCheckpoint,
  eveNamedDocumentCheckpointEntry,
  eveSearchText,
  eveSubagentSession,
  eveVote,
} from "./schema";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve completeEveConversationDeletion's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null -- jsdoc/require-param (#534): completeEveConversationDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): completeEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): completeEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): completeEveConversationDeletion uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): completeEveConversationDeletion accepts tx; row; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): completeEveConversationDeletion intentionally keeps the existing falsy-value behavior of identity; sandbox; remaining; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/max-nested-calls (#568): completeEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): completeEveConversationDeletion preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/**
 * Final application stage. The internal coordinator must confirm native payload,
 * sandbox and file removal before calling this; this is not a deletion endpoint.
 * Keep identity tombstones for replay protection and leave accounting intact.
 */
const completeEveConversationDeletion = async (
  ownerId: string,
  routeId: string
): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [identity] = await tx
      .select({ chatId: eveChat.id })
      .from(eveChat)
      .leftJoin(
        eveConversation,
        and(
          eq(eveConversation.chatId, eveChat.id),
          eq(eveConversation.ownerId, eveChat.ownerId),
          eq(eveConversation.id, routeId)
        )
      )
      .where(
        and(
          eq(eveChat.ownerId, ownerId),
          or(eq(eveChat.id, routeId), eq(eveConversation.id, routeId))
        )
      );
    if (!identity) {
      throw new Error("Conversation identity is unavailable.");
    }
    const condition = and(
      eq(eveConversation.ownerId, ownerId),
      eq(eveConversation.chatId, identity.chatId)
    );
    const family = await tx.select().from(eveConversation).where(condition);
    if (
      family.length === 0 ||
      family.some((row) => row.state !== "deleting" && row.state !== "deleted")
    ) {
      throw new Error(
        "The entire conversation family must be pending deletion."
      );
    }
    await tombstoneEveResponseGroups(tx, ownerId, family);
    const ids = family.map((row) => row.id);
    const [sandbox] = await tx
      .select({ name: eveCodeSandbox.name })
      .from(eveCodeSandbox)
      .where(
        and(
          inArray(eveCodeSandbox.conversationId, ids),
          eq(eveCodeSandbox.state, "unresolved")
        )
      )
      .limit(1);
    if (sandbox) {
      throw new Error("Code sandbox cleanup is incomplete.");
    }
    for (const table of [
      eveFileReference,
      eveImportedDocumentCheckpointEntry,
      eveImportedDocumentCheckpoint,
      eveNamedDocumentCheckpointEntry,
      eveNamedDocumentCheckpoint,
      eveDocumentCheckpointEntry,
      eveDocumentCheckpoint,
      eveDocumentHead,
      eveDocumentRevision,
    ]) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
      const [remaining] = await tx
        .select({ conversationId: table.conversationId })
        .from(table)
        .where(inArray(table.conversationId, ids))
        .limit(1);
      if (remaining) {
        throw new Error("Application content cleanup is incomplete.");
      }
    }
    // Transcript preparation and provenance must not survive a completed family deletion.
    await tx
      .delete(eveConversationCopyFile)
      .where(inArray(eveConversationCopyFile.conversationId, ids));
    await tx
      .delete(eveConversationCopy)
      .where(inArray(eveConversationCopy.conversationId, ids));
    await tx
      .delete(eveChatProject)
      .where(eq(eveChatProject.chatId, identity.chatId));
    await tx
      .delete(eveSearchText)
      .where(inArray(eveSearchText.conversationId, ids));
    await tx
      .delete(eveSubagentSession)
      .where(inArray(eveSubagentSession.conversationId, ids));
    await tx.delete(eveVote).where(inArray(eveVote.conversationId, ids));
    await tx
      .update(eveConversation)
      .set({
        firstMessage: "",
        initialContentHash: null,
        initialModelId: null,
        initialProjectId: null,
        initialRequest: null,
        state: "deleted",
        visibility: "private",
      })
      .where(condition);
    await tx
      .update(eveChat)
      .set({
        activeConversationId: null,
        isPinned: false,
        title: "",
        titleStatus: "fallback",
      })
      .where(
        and(eq(eveChat.id, identity.chatId), eq(eveChat.ownerId, ownerId))
      );
  });
};
/* oxlint-enable oxc/no-async-await */
interface EveDeletionState {
  rootId: typeof eveChat.$inferSelect.id;
  state: typeof eveConversation.$inferSelect.state;
}

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveDeletionState's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable no-magic-numbers, typescript/strict-boolean-expressions, unicorn/max-nested-calls -- no-magic-numbers (#517): getEveDeletionState uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/strict-boolean-expressions (#610): getEveDeletionState intentionally keeps the existing falsy-value behavior of row; member; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/max-nested-calls (#568): getEveDeletionState keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
/** Read the owner-visible root and native deletion state, including identity tombstones.
 * @param {string} ownerId - Owner required by both identity and member queries.
 * @param {string} conversationId - Root chat ID or member conversation ID to inspect.
 * @returns {Promise<EveDeletionState | undefined>} Root identity and state, or no receipt when the owner has no matching identity or member.
 */
const getEveDeletionState = async (
  ownerId: string,
  conversationId: string
): Promise<EveDeletionState | undefined> => {
  const [row] = await db
    .select({
      chatId: eveChat.id,
      state: eveConversation.state,
    })
    .from(eveChat)
    .leftJoin(
      eveConversation,
      and(
        eq(eveConversation.chatId, eveChat.id),
        eq(eveConversation.ownerId, eveChat.ownerId),
        eq(eveConversation.id, conversationId)
      )
    )
    .where(
      and(
        eq(eveChat.ownerId, ownerId),
        or(
          eq(eveChat.id, conversationId),
          eq(eveConversation.id, conversationId)
        )
      )
    )
    .limit(1);
  if (!row) {
    // oxlint-disable-next-line no-undefined -- Missing owner-visible identity has no deletion-state receipt.
    return undefined;
  }
  if (row.state) {
    return { rootId: row.chatId, state: row.state };
  }
  const [member] = await db
    .select({ state: eveConversation.state })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.chatId, row.chatId),
        eq(eveConversation.ownerId, ownerId)
      )
    )
    .limit(1);
  if (!member) {
    // oxlint-disable-next-line no-undefined -- An identity without an owner-visible member has no deletion-state receipt.
    return undefined;
  }
  return { rootId: row.chatId, state: member.state };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (completeEveConversationDeletion, getEveDeletionState); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
export { completeEveConversationDeletion, getEveDeletionState };
/* oxlint-enable import/no-named-export */
