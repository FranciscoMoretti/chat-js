import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { eveChat, eveConversation } from "@/lib/db/schema";

export const getPublicEveConversation = async (
  id: string
): Promise<
  | (typeof eveConversation.$inferSelect &
      Pick<typeof eveChat.$inferSelect, "title">)
  | undefined
> => {
  const [row] = await db
    .select({ chat: { title: eveChat.title }, conversation: eveConversation })
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
        eq(eveConversation.id, id),
        eq(eveConversation.visibility, "public"),
        eq(eveConversation.state, "bound")
      )
    )
    .limit(1);
  if (row !== undefined) {
    return { ...row.conversation, title: row.chat.title };
  }
  return undefined;
};

export const getSharing = async (
  ownerId: string,
  id: string
): Promise<
  Pick<typeof eveConversation.$inferSelect, "id" | "visibility"> | undefined
> => {
  const [row] = await db
    .select({ id: eveConversation.id, visibility: eveConversation.visibility })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, id),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound")
      )
    )
    .limit(1);
  return row;
};
export const setSharing = async (
  ownerId: string,
  id: string,
  visibility: "private" | "public"
): Promise<Pick<typeof eveConversation.$inferSelect, "id"> | undefined> => {
  const [row] = await db
    .update(eveConversation)
    .set({ visibility })
    .where(
      and(
        eq(eveConversation.id, id),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound")
      )
    )
    .returning({ id: eveConversation.id });
  return row;
};
