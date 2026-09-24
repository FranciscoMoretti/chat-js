import { eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveChat, eveConversation } from "../lib/db/schema";

type ConversationFixture = Omit<
  typeof eveConversation.$inferInsert,
  "chatId" | "updatedAt"
> & {
  chatId?: string;
  isPinned?: boolean;
  title?: string;
  updatedAt?: Date | SQL;
};

/** Seed metadata and session membership together, including parent-first batches. */
export const insertEveConversationFixtures = (
  input: ConversationFixture | ConversationFixture[]
) =>
  db.transaction(async (tx) => {
    const inserted: (typeof eveConversation.$inferSelect)[] = [];
    for (const fixture of Array.isArray(input) ? input : [input]) {
      const {
        chatId: requestedChatId,
        isPinned,
        title,
        updatedAt,
        ...conversation
      } = fixture;
      const [parent] = conversation.parentConversationId
        ? // oxlint-disable-next-line eslint/no-await-in-loop -- Later fixture rows may depend on a parent inserted earlier in this transaction.
          await tx
            .select({ chatId: eveConversation.chatId })
            .from(eveConversation)
            .where(eq(eveConversation.id, conversation.parentConversationId))
        : [];
      const chatId = requestedChatId ?? parent?.chatId ?? crypto.randomUUID();
      // oxlint-disable-next-line eslint/no-await-in-loop -- Membership requires metadata to exist before the session row.
      await tx
        .insert(eveChat)
        .values({
          id: chatId,
          isPinned,
          ownerId: conversation.ownerId,
          title: title ?? conversation.firstMessage,
          titleStatus: title ? "manual" : "fallback",
          updatedAt,
        })
        .onConflictDoNothing();
      // oxlint-disable-next-line eslint/no-await-in-loop -- Preserve parent-before-child insertion order and return the actual session rows.
      const [row] = await tx
        .insert(eveConversation)
        .values({ ...conversation, chatId })
        .returning();
      inserted.push(row);
    }
    return inserted;
  });
