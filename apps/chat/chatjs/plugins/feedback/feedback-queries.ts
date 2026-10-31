import { and, eq, sql } from "drizzle-orm";
import type { PgSelectBase, PgSelectWithout } from "drizzle-orm/pg-core";
import type { GetSelectTableName } from "drizzle-orm/query-builders/select.types";
import { db } from "@/lib/db/client";
import { eveConversation } from "@/lib/db/schema";
import { eveVote } from "./feedback-schema";

const hasQueryRow: (row: unknown) => boolean = Boolean;
type WriteTransaction = Readonly<
  Pick<typeof db, "select" | "execute" | "insert" | "delete" | "update">
>;

/**
 * Reads vote state for messages in one bound conversation owned by the user.
 * Public sharing does not grant access to these owner-only votes.
 * @param {string} ownerId Owner whose vote state is requested.
 * @param {string} conversationId Bound conversation to read.
 * @returns {PromiseLike<Pick<typeof eveVote.$inferSelect, "isUpvoted" | "messageId">[]>} Lazy owner-filtered query. Await it or consume it with .then or .execute to read matching rows; Drizzle query methods remain available before consumption.
 */
export const getEveMessageVotes = (
  ownerId: string,
  conversationId: string
): PgSelectWithout<
  PgSelectBase<
    GetSelectTableName<typeof eveVote>,
    Pick<typeof eveVote, "isUpvoted" | "messageId">,
    "partial",
    Record<
      | GetSelectTableName<typeof eveVote>
      | GetSelectTableName<typeof eveConversation>,
      "not-null"
    >
  >,
  false,
  "where"
> =>
  db
    .select({ isUpvoted: eveVote.isUpvoted, messageId: eveVote.messageId })
    .from(eveVote)
    .innerJoin(eveConversation, eq(eveConversation.id, eveVote.conversationId))
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound")
      )
    );

/**
 * Saves a message vote after validating the message against the native Eve snapshot.
 * The owner and bound-conversation check runs under the conversation-family lock.
 * @param {string} ownerId Owner submitting the vote.
 * @param {string} conversationId Bound conversation containing the message.
 * @param {string} messageId Native message ID being rated.
 * @param {boolean} isUpvoted Whether the message received a positive vote.
 * @returns {Promise<{ isUpvoted: boolean; messageId: string } | null>} The saved vote, or null when the conversation is no longer bound to the owner.
 */
export const saveEveMessageVote = async (
  ownerId: string,
  conversationId: string,
  messageId: string,
  isUpvoted: boolean
): Promise<Pick<
  typeof eveVote.$inferSelect,
  "isUpvoted" | "messageId"
> | null> =>
  await db.transaction(async (tx: WriteTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [conversation] = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    if (!hasQueryRow(conversation)) {
      return null;
    }
    const [saved] = await tx
      .insert(eveVote)
      .values({ conversationId, isUpvoted, messageId })
      .onConflictDoUpdate({
        set: { isUpvoted },
        target: [eveVote.conversationId, eveVote.messageId],
      })
      .returning({
        isUpvoted: eveVote.isUpvoted,
        messageId: eveVote.messageId,
      });
    return saved;
  });

export const getFeedbackConversation = async (
  ownerId: string,
  conversationId: string
) => {
  const conversations = await db
    .select({
      sessionId: eveConversation.sessionId,
      state: eveConversation.state,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.state, "bound")
      )
    );
  return conversations.at(0);
};
