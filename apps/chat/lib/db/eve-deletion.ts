import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "./client";
import { tombstoneEveResponseGroups } from "./eve-response-groups";
import {
  eveCodeSandbox,
  eveChat,
  eveChatProject,
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
  eveVote,
  eveSearchText,
  eveSubagentSession,
} from "./schema";

/* oxlint-disable import/group-exports, jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null  --
 * import/group-exports (#523): completeEveConversationDeletion stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named completeEveConversationDeletion API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): completeEveConversationDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): completeEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): completeEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): completeEveConversationDeletion uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): completeEveConversationDeletion sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): completeEveConversationDeletion accepts tx; row; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): completeEveConversationDeletion intentionally keeps the existing falsy-value behavior of identity; sandbox; remaining; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): completeEveConversationDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): completeEveConversationDeletion preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * Final application stage. The internal coordinator must confirm native payload,
 * sandbox and file removal before calling this; this is not a deletion endpoint.
 * Keep identity tombstones for replay protection and leave accounting intact.
 */
export const completeEveConversationDeletion = async (
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
/* oxlint-enable import/group-exports, jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls  --
 * import/group-exports (#523): getEveDeletionState stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getEveDeletionState API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): getEveDeletionState's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getEveDeletionState's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): getEveDeletionState uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): getEveDeletionState derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): getEveDeletionState uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): getEveDeletionState sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getEveDeletionState's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveDeletionState's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): getEveDeletionState intentionally keeps the existing falsy-value behavior of row; member; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): getEveDeletionState keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/** Includes identity tombstones so owners can retry and inspect completed deletion. */
export const getEveDeletionState = async (
  ownerId: string,
  conversationId: string
) => {
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
    return;
  }
  if (row.state) {
    // oxlint-disable-next-line typescript/consistent-return -- #580: getEveDeletionState has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
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
  // oxlint-disable-next-line typescript/consistent-return -- #580: getEveDeletionState has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return member ? { rootId: row.chatId, state: member.state } : undefined;
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
