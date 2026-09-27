import { and, eq, sql } from "drizzle-orm";

import { eveSeedSearchText } from "../eve/search-text";
import { db } from "./client";
import { lockEveCopyOwners, readEveCopy } from "./eve-copy-journal";
import { CreationConflictError } from "./eve-queries";
import { writeEveSearchText } from "./eve-search";
import { eveChat, eveConversation, eveConversationCopy } from "./schema";

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
