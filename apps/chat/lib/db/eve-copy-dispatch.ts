import { and, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { lockEveCopyOwners, readEveCopy } from "./eve-copy-journal";
import { CreationConflict } from "./eve-queries";
import { eveConversation, eveConversationCopy } from "./schema";

/** Used only by the authenticated native seed resolver; accepted copies no longer depend on their source. */
export async function resolveAcceptedEveCopySeed(
  ownerId: string,
  operationId: string
) {
  const { copy, conversation } = await readEveCopy(db, ownerId, operationId);
  if (
    copy.phase !== "accepted" ||
    !copy.seed ||
    !["creating", "uncertain"].includes(conversation.state)
  ) {
    throw new CreationConflict("This copy is not awaiting native creation.");
  }
  return copy.seed;
}

/** The callback must use the seed operation namespace with this destination reservation ID. */
export async function dispatchEveCopy(
  ownerId: string,
  conversationId: string,
  create: (operationId: string) => Promise<string>
) {
  try {
    return await db.transaction(async (tx) => {
      const [lock] = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(hashtextextended(${`eve-create:${conversationId}`}, 0)) as locked`
      );
      if (!lock?.locked) {
        throw new CreationConflict(
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
        throw new CreationConflict("This saved copy cannot be dispatched.");
      }
      const sessionId = await create(conversation.id);
      if (!sessionId) {
        throw new Error("Copy creation did not return a native session.");
      }
      await tx
        .update(eveConversation)
        .set({ state: "bound", sessionId })
        .where(eq(eveConversation.id, conversation.id));
      await tx
        .update(eveConversationCopy)
        .set({ phase: "bound", seed: null })
        .where(eq(eveConversationCopy.conversationId, conversation.id));
      return { id: conversation.id, sessionId };
    });
  } catch (error) {
    if (!(error instanceof CreationConflict)) {
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
}

/** Rejected preparations are provably never dispatched; the cleanup coordinator can omit native retirement. */
export async function rejectUnacceptedEveCopy(
  ownerId: string,
  conversationId: string
) {
  return await db.transaction(async (tx) => {
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
      throw new CreationConflict(
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
}
