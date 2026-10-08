import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { QueryPromise } from "drizzle-orm/query-promise";

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
/* oxlint-enable sort-imports */

/** Select the requested root or joined member while retaining the owner filter.
 * @param {string} ownerId - Owner required for either identity alternative.
 * @param {string} conversationId - Root chat ID or joined member conversation ID.
 * @returns {ReturnType<typeof and>} Native Drizzle owner-and-identity predicate, with the root alternative evaluated before the member alternative.
 */
const ownerVisibleEveIdentityCondition = (
  ownerId: string,
  conversationId: string
): ReturnType<typeof and> =>
  and(
    eq(eveChat.ownerId, ownerId),
    or(eq(eveChat.id, conversationId), eq(eveConversation.id, conversationId))
  );

/** Require an identity before looking up or mutating its conversation family.
 * @param {Readonly<{ chatId: typeof eveChat.$inferSelect.id }> | undefined} identity - First owner-filtered identity row, absent when the native query found no match.
 * @returns {Readonly<{ chatId: typeof eveChat.$inferSelect.id }>} The same identity object; throws before family reads when it is absent.
 */
const requireEveDeletionIdentity = (
  identity: Readonly<{ chatId: typeof eveChat.$inferSelect.id }> | undefined
): Readonly<{ chatId: typeof eveChat.$inferSelect.id }> => {
  if (!identity) {
    throw new Error("Conversation identity is unavailable.");
  }
  return identity;
};

/** Require every member to have entered deletion before final tombstoning.
 * @param {readonly Readonly<Pick<typeof eveConversation.$inferSelect, "state">>[]} family - Native conversation state readers for the owner-visible family.
 * @returns {void} Rejects an empty family or the first member outside deleting/deleted; reads no member IDs.
 */
const assertEveFamilyPendingDeletion = (
  family: readonly Readonly<
    Pick<typeof eveConversation.$inferSelect, "state">
  >[]
): void => {
  if (
    // oxlint-disable-next-line no-magic-numbers -- An empty family cannot be committed as deleted; zero is the direct collection-emptiness comparison.
    family.length === 0 ||
    family.some(
      (row: Readonly<Pick<typeof eveConversation.$inferSelect, "state">>) =>
        row.state !== "deleting" && row.state !== "deleted"
    )
  ) {
    throw new Error("The entire conversation family must be pending deletion.");
  }
};

/** Read the first unresolved native sandbox without changing query construction or execution.
 * @param {Readonly<Pick<typeof db, "select">>} query - Existing transaction select capability; its receiver is forwarded unchanged.
 * @param {readonly string[]} ids - Family conversation IDs already read after response-group tombstoning.
 * @returns {QueryPromise<readonly (Readonly<Pick<typeof eveCodeSandbox.$inferSelect, "name">> | undefined)[]>} The original native query object; an empty result has no first row.
 */
const findUnresolvedEveFamilySandbox = (
  query: Readonly<Pick<typeof db, "select">>,
  ids: readonly string[]
): QueryPromise<
  readonly (
    | Readonly<Pick<typeof eveCodeSandbox.$inferSelect, "name">>
    | undefined
  )[]
> =>
  query
    .select({ name: eveCodeSandbox.name })
    .from(eveCodeSandbox)
    .where(
      and(
        inArray(eveCodeSandbox.conversationId, ids),
        eq(eveCodeSandbox.state, "unresolved")
      )
    )
    // oxlint-disable-next-line no-magic-numbers -- This cleanup-existence probe needs only the first unresolved sandbox.
    .limit(1);

/** Read the owner-filtered root/member identity before family finalization.
 * @param {Readonly<Pick<typeof db, "select">>} query - Existing transaction select capability, used with its original receiver.
 * @param {string} ownerId - Owner required by the joined identity predicate.
 * @param {string} routeId - Root chat ID or joined member conversation ID.
 * @returns {QueryPromise<readonly ({ readonly chatId: typeof eveChat.$inferSelect.id } | undefined)[]>} Original native query object; an empty result has no first row.
 */
const readOwnedEveDeletionIdentity = (
  query: Readonly<Pick<typeof db, "select">>,
  ownerId: string,
  routeId: string
): QueryPromise<
  readonly ({ readonly chatId: typeof eveChat.$inferSelect.id } | undefined)[]
> =>
  query
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
    .where(ownerVisibleEveIdentityCondition(ownerId, routeId));

/** Read the first surviving application-content row from one of the nine cleanup dependency tables.
 * @param {Readonly<Pick<typeof db, "select">>} query - Existing transaction select capability.
 * @param {Readonly<typeof eveFileReference | typeof eveImportedDocumentCheckpointEntry | typeof eveImportedDocumentCheckpoint | typeof eveNamedDocumentCheckpointEntry | typeof eveNamedDocumentCheckpoint | typeof eveDocumentCheckpointEntry | typeof eveDocumentCheckpoint | typeof eveDocumentHead | typeof eveDocumentRevision>} table - Original native dependency table in declared cleanup order.
 * @param {readonly string[]} ids - Same family ID array supplied to the native inArray column overload.
 * @returns {QueryPromise<readonly ({ readonly conversationId: typeof table.$inferSelect.conversationId } | undefined)[]>} Original native query object; an empty result has no first row.
 */
const readEveFamilyApplicationContent = (
  query: Readonly<Pick<typeof db, "select">>,

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The original Drizzle table feeds from/select generic receivers; deep readonly projection loses the native column/table contract (TS2322).
  table: Readonly<
    | typeof eveFileReference
    | typeof eveImportedDocumentCheckpointEntry
    | typeof eveImportedDocumentCheckpoint
    | typeof eveNamedDocumentCheckpointEntry
    | typeof eveNamedDocumentCheckpoint
    | typeof eveDocumentCheckpointEntry
    | typeof eveDocumentCheckpoint
    | typeof eveDocumentHead
    | typeof eveDocumentRevision
  >,
  ids: readonly string[]
): QueryPromise<
  readonly (
    | { readonly conversationId: typeof table.$inferSelect.conversationId }
    | undefined
  )[]
> =>
  query
    .select({ conversationId: table.conversationId })
    .from(table)
    .where(inArray(table.conversationId, ids))
    // oxlint-disable-next-line no-magic-numbers -- Stop at the first surviving application-content row; this query tests existence.
    .limit(1);

/** Read the first owner-visible identity and joined member state for a deletion receipt.
 * @param {Readonly<Pick<typeof db, "select">>} query - Existing select capability, forwarded without cloning or rebinding.
 * @param {string} ownerId - Owner required by the joined identity predicate.
 * @param {string} conversationId - Root chat ID or joined member conversation ID.
 * @returns {QueryPromise<readonly ({ readonly chatId: typeof eveChat.$inferSelect.id; readonly state: typeof eveConversation.$inferSelect.state | null } | undefined)[]>} Original native query object; an empty result has no first row.
 */
const readOwnedEveDeletionReceipt = (
  query: Readonly<Pick<typeof db, "select">>,
  ownerId: string,
  conversationId: string
): QueryPromise<
  readonly (
    | {
        readonly chatId: typeof eveChat.$inferSelect.id;
        readonly state: typeof eveConversation.$inferSelect.state | null;
      }
    | undefined
  )[]
> =>
  query
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
    .where(ownerVisibleEveIdentityCondition(ownerId, conversationId))
    // oxlint-disable-next-line no-magic-numbers -- The deletion receipt needs only the first owner-visible identity or member state.
    .limit(1);

/** Read the owner-visible member state when a root receipt has no joined member state.
 * @param {Readonly<Pick<typeof db, "select">>} query - Existing select capability.
 * @param {string} ownerId - Owner required by the member-state predicate.
 * @param {Readonly<{ chatId: typeof eveChat.$inferSelect.id }>} row - Same root identity object; chatId is read only at the original predicate position.
 * @returns {QueryPromise<readonly (Readonly<Pick<typeof eveConversation.$inferSelect, "state">> | undefined)[]>} Original native query object; an empty result has no first row.
 */
const readOwnedEveDeletionMemberState = (
  query: Readonly<Pick<typeof db, "select">>,
  ownerId: string,
  row: Readonly<{ chatId: typeof eveChat.$inferSelect.id }>
): QueryPromise<
  readonly (
    | Readonly<Pick<typeof eveConversation.$inferSelect, "state">>
    | undefined
  )[]
> =>
  query
    .select({ state: eveConversation.state })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.chatId, row.chatId),
        eq(eveConversation.ownerId, ownerId)
      )
    )
    // oxlint-disable-next-line no-magic-numbers -- The deletion receipt needs only the first owner-visible identity or member state.
    .limit(1);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve completeEveConversationDeletion's awaited sequencing and rejected-Promise behavior. */

/**
 * Final application stage. The internal coordinator must confirm native payload,
 * sandbox and file removal before calling this; this is not a deletion endpoint.
 * Keep identity tombstones for replay protection and leave accounting intact.
 * @param {string} ownerId - Owner whose family lock and every identity predicate fence this transaction.
 * @param {string} routeId - Root chat ID or member conversation ID resolving the family to tombstone.
 * @returns {Promise<void>} Resolves after the application tombstone transaction commits; rejects for a missing identity, a family outside deletion, or remaining sandbox/application content.
 */
// oxlint-disable-next-line max-lines-per-function -- Keep the finalization transaction visible through owner locking, family preconditions, surviving-content checks and identity tombstone updates; a phase extraction needs separate sequencing verification.
const completeEveConversationDeletion = async (
  ownerId: string,
  routeId: string
): Promise<void> => {
  await db.transaction(
    // oxlint-disable-next-line max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types -- Preserve the native Drizzle transaction passed unchanged to tombstoneEveResponseGroups; its protected schema/index members reject a mapped Readonly transaction. Preserve the ordered owner lock, family precondition, response-group tombstones, sandbox/content checks, provenance deletion and identity tombstones within the same transaction; extracting awaited phases needs separate suspension/trace verification. This original transaction performs .execute, .delete, .update operations under caller-held locks; preserve the native writer contract.
    async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
      );
      const [queriedIdentity] = await readOwnedEveDeletionIdentity(
        tx,
        ownerId,
        routeId
      );
      const identity = requireEveDeletionIdentity(queriedIdentity);
      const condition = and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.chatId, identity.chatId)
      );
      const family = await tx.select().from(eveConversation).where(condition);
      assertEveFamilyPendingDeletion(family);
      await tombstoneEveResponseGroups(tx, ownerId, family);
      const ids = family.map(
        (row: Readonly<Pick<typeof eveConversation.$inferSelect, "id">>) =>
          row.id
      );
      const [sandbox] = await findUnresolvedEveFamilySandbox(tx, ids);
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
        // oxlint-disable-next-line eslint/no-await-in-loop -- Read the nine dependency tables in declared order on this transaction, stopping at the first surviving row; parallel probes would dispatch later queries before that failure.
        const [remaining] = await readEveFamilyApplicationContent(
          tx,
          table,
          ids
        );
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
          // oxlint-disable-next-line unicorn/no-null -- Clear the persisted nullable initialContentHash column during identity tombstoning; undefined would omit the update.
          initialContentHash: null,
          // oxlint-disable-next-line unicorn/no-null -- Clear the persisted nullable initialModelId column during identity tombstoning; undefined would omit the update.
          initialModelId: null,
          // oxlint-disable-next-line unicorn/no-null -- Clear the persisted nullable initialProjectId column during identity tombstoning; undefined would omit the update.
          initialProjectId: null,
          // oxlint-disable-next-line unicorn/no-null -- Clear the persisted nullable initialRequest column during identity tombstoning; undefined would omit the update.
          initialRequest: null,
          state: "deleted",
          visibility: "private",
        })
        .where(condition);
      await tx
        .update(eveChat)
        .set({
          // oxlint-disable-next-line unicorn/no-null -- Clear the persisted nullable activeConversationId column during identity tombstoning; undefined would omit the update.
          activeConversationId: null,
          isPinned: false,
          title: "",
          titleStatus: "fallback",
        })
        .where(
          and(eq(eveChat.id, identity.chatId), eq(eveChat.ownerId, ownerId))
        );
    }
  );
};
/* oxlint-enable oxc/no-async-await */
interface EveDeletionState {
  rootId: typeof eveChat.$inferSelect.id;
  state: typeof eveConversation.$inferSelect.state;
}

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveDeletionState's awaited sequencing and rejected-Promise behavior. */

/** Read the owner-visible root and native deletion state, including identity tombstones.
 * @param {string} ownerId - Owner required by both identity and member queries.
 * @param {string} conversationId - Root chat ID or member conversation ID to inspect.
 * @returns {Promise<EveDeletionState | undefined>} Root identity and state, or no receipt when the owner has no matching identity or member.
 */
const getEveDeletionState = async (
  ownerId: string,
  conversationId: string
): Promise<EveDeletionState | undefined> => {
  const [row] = await readOwnedEveDeletionReceipt(db, ownerId, conversationId);
  if (!row) {
    // oxlint-disable-next-line no-undefined -- Missing owner-visible identity has no deletion-state receipt.
    return undefined;
  }
  if (row.state) {
    return { rootId: row.chatId, state: row.state };
  }
  const [member] = await readOwnedEveDeletionMemberState(db, ownerId, row);
  if (!member) {
    // oxlint-disable-next-line no-undefined -- An identity without an owner-visible member has no deletion-state receipt.
    return undefined;
  }
  return { rootId: row.chatId, state: member.state };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (completeEveConversationDeletion, getEveDeletionState); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
export { completeEveConversationDeletion, getEveDeletionState };
/* oxlint-enable import/no-named-export */
