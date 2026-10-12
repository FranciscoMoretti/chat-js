import { eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveChat, eveConversation } from "../lib/db/schema";

type ConversationFixture = Readonly<
  Omit<typeof eveConversation.$inferInsert, "chatId" | "updatedAt">
> & {
  readonly chatId?: string;
  readonly isPinned?: boolean;
  readonly title?: string;
  readonly updatedAt?: Date | SQL;
};

/**
 * Inserts conversation fixture rows and their chat metadata in one transaction.
 * Parent-first batches inherit their parent's chat ID; other fixtures receive a new chat ID.
 * @param {ConversationFixture | ConversationFixture[]} input One fixture or an ordered batch of fixtures.
 * @returns {Promise<(typeof eveConversation.$inferSelect)[]>} The inserted conversation rows in input order.
 */
export const insertEveConversationFixtures = async (
  input: Readonly<ConversationFixture> | Readonly<ConversationFixture>[]
) =>
  await db.transaction(async (tx) => {
    const inserted: (typeof eveConversation.$inferSelect)[] = [];
    /* oxlint-disable eslint/no-await-in-loop -- Parent-first transaction batches may reference chats and conversations inserted by earlier fixture rows. */
    for (const fixture of Array.isArray(input) ? input : [input]) {
      const {
        chatId: requestedChatId,
        isPinned,
        title,
        updatedAt,
        ...conversation
      } = fixture;
      const [parent] =
        conversation.parentConversationId === undefined ||
        conversation.parentConversationId === null ||
        conversation.parentConversationId === ""
          ? []
          : await tx
              .select({ chatId: eveConversation.chatId })
              .from(eveConversation)
              .where(eq(eveConversation.id, conversation.parentConversationId));
      const chatId = requestedChatId ?? parent?.chatId ?? crypto.randomUUID();
      await tx
        .insert(eveChat)
        .values({
          id: chatId,
          isPinned,
          ownerId: conversation.ownerId,
          title: title ?? conversation.firstMessage,
          titleStatus:
            title === undefined || title === null || title === ""
              ? "fallback"
              : "manual",
          updatedAt,
        })
        .onConflictDoNothing();
      const [row] = await tx
        .insert(eveConversation)
        .values({ ...conversation, chatId })
        .returning();
      inserted.push(row);
    }
    /* oxlint-enable eslint/no-await-in-loop */
    return inserted;
  });
