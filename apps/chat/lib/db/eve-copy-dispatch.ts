/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/search-text" dependency within this package instead of introducing an alias or barrel API.
 */
import { and, eq, sql } from "drizzle-orm";

import { eveSeedSearchText } from "../eve/search-text";
import { db } from "./client";
import { lockEveCopyOwners, readEveCopy } from "./eve-copy-journal";
import { CreationConflictError } from "./eve-queries";
import { writeEveSearchText } from "./eve-search";
import { eveChat, eveConversation, eveConversationCopy } from "./schema";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/group-exports (#523): resolveAcceptedEveCopySeed stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): resolveAcceptedEveCopySeed's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): resolveAcceptedEveCopySeed's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep resolveAcceptedEveCopySeed's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep resolveAcceptedEveCopySeed's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
/** Used only by the authenticated native seed resolver; accepted copies no longer depend on their source. */
export const resolveAcceptedEveCopySeed = async (
  ownerId: string,
  operationId: string
) => {
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/group-exports (#523): dispatchEveCopy stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): dispatchEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): dispatchEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): dispatchEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): dispatchEveCopy keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep dispatchEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep dispatchEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): dispatchEveCopy accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): dispatchEveCopy intentionally keeps the existing falsy-value behavior of conversation.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): dispatchEveCopy preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** The callback must use the seed operation namespace with this destination reservation ID. */
export const dispatchEveCopy = async (
  ownerId: string,
  conversationId: string,
  create: (operationId: string) => Promise<string>
) => {
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/group-exports (#523): rejectUnacceptedEveCopy stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): rejectUnacceptedEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): rejectUnacceptedEveCopy's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep rejectUnacceptedEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep rejectUnacceptedEveCopy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): rejectUnacceptedEveCopy accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): rejectUnacceptedEveCopy intentionally keeps the existing falsy-value behavior of conversation.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): rejectUnacceptedEveCopy preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Rejected preparations are provably never dispatched; the cleanup coordinator can omit native retirement. */
export const rejectUnacceptedEveCopy = async (
  ownerId: string,
  conversationId: string
) =>
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
