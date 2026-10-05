import { and, eq, sql } from "drizzle-orm";

import { eveSeedSearchText } from "@/lib/eve/search-text";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "./client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { lockEveCopyOwners, readEveCopy } from "./eve-copy-journal";
/* oxlint-enable sort-imports */
import { CreationConflictError } from "./eve-queries";
import { writeEveSearchText } from "./eve-search";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveChat, eveConversation, eveConversationCopy } from "./schema";
/* oxlint-enable sort-imports */

/**
 * Used only by the authenticated native seed resolver; accepted copies no longer depend on their source.
 * @param {string} ownerId Owner whose accepted destination copy is authorized.
 * @param {string} operationId Destination reservation identity used by the authenticated seed resolver.
 * @returns {Promise<NonNullable<typeof eveConversationCopy.$inferSelect.seed>>} The preserved native seed while accepted creation is pending; unavailable or dispatched copies throw.
 */
const resolveAcceptedEveCopySeed = async (
  ownerId: string,
  operationId: string
): Promise<NonNullable<typeof eveConversationCopy.$inferSelect.seed>> => {
  const { copy, conversation } = await readEveCopy(db, ownerId, operationId);
  if (
    copy.phase !== "accepted" ||
    !copy.seed ||
    !["creating", "uncertain"].includes(conversation.state)
  ) {
    throw new CreationConflictError(
      "This copy is not awaiting native creation."
    );
  }
  return copy.seed;
};

/* oxlint-disable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --max-lines-per-function (#510): dispatchEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): dispatchEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): dispatchEveCopy accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): dispatchEveCopy intentionally keeps the existing falsy-value behavior of conversation.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/no-null (#570): dispatchEveCopy preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * The callback must use the seed operation namespace with this destination reservation ID.
 * @param {string} ownerId Owner whose accepted copy is dispatched under the creation lock.
 * @param {string} conversationId Exact accepted destination reservation, also used for native idempotency.
 * @param {(operationId: string) => Promise<string>} create Native seed creation callback returning the accepted session identity.
 * @returns {Promise<{ id: string; sessionId: string }>} Existing or newly bound destination/session identities after atomic metadata and search updates.
 */
const dispatchEveCopy = async (
  ownerId: string,
  conversationId: string,
  create: (operationId: string) => Promise<string>
): Promise<{ id: string; sessionId: string }> => {
  try {
    return await db.transaction(async (tx) => {
      const [lock] = await tx.execute<{
        locked: boolean;
      }>(
        sql`select pg_try_advisory_xact_lock(hashtextextended(${`eve-create:${conversationId}`}, 0)) as locked`
      );
      if (!lock?.locked) {
        throw new CreationConflictError(
          "Copy creation is still in progress. Retry the same operation."
        );
      }
      const { copy, conversation } = await readEveCopy(
        tx,
        ownerId,
        conversationId
      );
      if (
        copy.phase === "bound" &&
        conversation.state === "bound" &&
        conversation.sessionId
      ) {
        return { id: conversation.id, sessionId: conversation.sessionId };
      }
      if (
        copy.phase !== "accepted" ||
        !copy.seed ||
        !["creating", "uncertain"].includes(conversation.state)
      ) {
        throw new CreationConflictError(
          "This saved copy cannot be dispatched."
        );
      }
      const sessionId = await create(conversation.id);
      if (!sessionId) {
        throw new Error("Copy creation did not return a native session.");
      }
      await tx
        .update(eveConversation)
        .set({ sessionId, state: "bound" })
        .where(eq(eveConversation.id, conversation.id));
      await tx
        .update(eveChat)
        .set({ activeConversationId: conversation.id, updatedAt: new Date() })
        .where(
          and(eq(eveChat.id, conversation.chatId), eq(eveChat.ownerId, ownerId))
        );
      await writeEveSearchText(
        tx,
        ownerId,
        conversation.id,
        eveSeedSearchText(copy.seed.messages)
      );
      await tx
        .update(eveConversationCopy)
        .set({ phase: "bound", seed: null })
        .where(eq(eveConversationCopy.conversationId, conversation.id));
      return { id: conversation.id, sessionId };
    });
  } catch (error) {
    if (!(error instanceof CreationConflictError)) {
      await db
        .update(eveConversation)
        .set({ state: "uncertain" })
        .where(
          and(
            eq(eveConversation.id, conversationId),
            eq(eveConversation.ownerId, ownerId),
            eq(eveConversation.creationKind, "copy"),
            eq(eveConversation.state, "creating")
          )
        );
    }
    throw error;
  }
};
/* oxlint-enable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --typescript/prefer-readonly-parameter-types (#565): rejectUnacceptedEveCopy accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): rejectUnacceptedEveCopy intentionally keeps the existing falsy-value behavior of conversation.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/no-null (#570): rejectUnacceptedEveCopy preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * Rejected preparations are provably never dispatched; the cleanup coordinator can omit native retirement.
 * @param {string} ownerId Owner whose copy family lock fences rejection.
 * @param {string} conversationId Unaccepted destination preparation whose metadata is cleared.
 * @returns {Promise<{ id: string; neverDispatched: boolean }>} The destination identity and never-dispatched marker after transactional rejection; accepted or native-bound copies throw.
 */
const rejectUnacceptedEveCopy = async (
  ownerId: string,
  conversationId: string
): Promise<{ id: string; neverDispatched: boolean }> =>
  await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [ownerId]);
    const { copy, conversation } = await readEveCopy(
      tx,
      ownerId,
      conversationId
    );
    if (
      copy.phase === "accepted" ||
      copy.phase === "bound" ||
      conversation.sessionId
    ) {
      throw new CreationConflictError(
        "Accepted copies require normal native recovery or deletion."
      );
    }
    await tx
      .update(eveConversationCopy)
      .set({ phase: "rejected", plan: null, seed: null })
      .where(eq(eveConversationCopy.conversationId, conversationId));
    if (conversation.state !== "deleted") {
      await tx
        .update(eveConversation)
        .set({ state: "deleting", visibility: "private" })
        .where(eq(eveConversation.id, conversationId));
    }
    return { id: conversationId, neverDispatched: true };
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
export { dispatchEveCopy, rejectUnacceptedEveCopy, resolveAcceptedEveCopySeed };
