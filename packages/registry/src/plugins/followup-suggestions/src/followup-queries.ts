import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { eveConversation } from "@/lib/db/schema";
import { eveFollowup } from "./followup-schema";

/** Claim before any paid call. A crashed claim is deliberately never retried. */
export const claimEveFollowup = async (
  ownerId: string,
  sessionId: string,
  turnId: string,
  eventId: string
): Promise<string | null> =>
  await db.transaction(async (tx) => {
    const conversations = await tx
      .select({ chatId: eveConversation.chatId })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.sessionId, sessionId),
          eq(eveConversation.state, "bound")
        )
      )
      .for("update");
    const conversation = conversations.at(0);
    if (conversation === undefined) {
      return null;
    }
    const [claim] = await tx
      .insert(eveFollowup)
      .values({ ...conversation, ownerId, turnId, sessionId, eventId })
      .onConflictDoNothing()
      .returning({ chatId: eveFollowup.chatId });
    return claim?.chatId ?? null;
  });

export const finishEveFollowup = async (
  ownerId: string,
  chatId: string,
  eventId: string,
  suggestions: readonly string[]
): Promise<void> => {
  await db
    .update(eveFollowup)
    .set({ suggestions: [...suggestions] })
    .where(
      and(
        eq(eveFollowup.ownerId, ownerId),
        eq(eveFollowup.chatId, chatId),
        eq(eveFollowup.eventId, eventId)
      )
    );
};

export const getEveFollowup = async (
  ownerId: string,
  conversationId: string,
  eventId: string
): Promise<readonly string[] | null> => {
  const [row] = await db
    .select({ suggestions: eveFollowup.suggestions })
    .from(eveFollowup)
    .innerJoin(
      eveConversation,
      and(
        eq(eveFollowup.chatId, eveConversation.chatId),
        eq(eveFollowup.ownerId, eveConversation.ownerId)
      )
    )
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound"),
        eq(eveFollowup.eventId, eventId)
      )
    );
  return row?.suggestions ?? null;
};
