import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { eveChat, eveConversation } from "@/lib/db/schema";

const SINGLE_MATCH_LIMIT = 1;
const isEveRootTitlePending = async (
  ownerId: string,
  conversationId: string,
  fallbackTitle: string
): Promise<boolean> => {
  const [row] = await db
    .select({ id: eveChat.id })
    .from(eveConversation)
    .innerJoin(
      eveChat,
      and(
        eq(eveChat.id, eveConversation.chatId),
        eq(eveChat.ownerId, eveConversation.ownerId)
      )
    )
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound"),
        eq(eveChat.title, fallbackTitle),
        eq(eveChat.titleStatus, "pending")
      )
    )
    .limit(SINGLE_MATCH_LIMIT);
  return Boolean(row);
};

const replaceEveRootFallbackTitle = async (
  ownerId: string,
  conversationId: string,
  fallbackTitle: string,
  generatedTitle: string
): Promise<boolean> => {
  const [row] = await db
    .update(eveChat)
    .set({ title: generatedTitle, titleStatus: "generated" })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound"),
        eq(eveChat.id, eveConversation.chatId),
        eq(eveChat.ownerId, ownerId),
        eq(eveChat.title, fallbackTitle),
        eq(eveChat.titleStatus, "pending")
      )
    )
    .returning({ id: eveChat.id });
  return Boolean(row);
};

const settleEveRootFallbackTitle = async (
  ownerId: string,
  conversationId: string,
  fallbackTitle: string
): Promise<boolean> => {
  const [row] = await db
    .update(eveChat)
    .set({ titleStatus: "fallback" })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound"),
        eq(eveChat.id, eveConversation.chatId),
        eq(eveChat.ownerId, ownerId),
        eq(eveChat.title, fallbackTitle),
        eq(eveChat.titleStatus, "pending")
      )
    )
    .returning({ id: eveChat.id });
  return Boolean(row);
};

export {
  isEveRootTitlePending,
  replaceEveRootFallbackTitle,
  settleEveRootFallbackTitle,
};
