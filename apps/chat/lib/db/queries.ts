// Shared by Next.js and the standalone EVE server; env guards server credentials.
import type { PgSelectBase, PgSelectWithout } from "drizzle-orm/pg-core";
import type { User, UserModelPreference } from "./schema";
import { and, eq, sql } from "drizzle-orm";
import type { GetSelectTableName } from "drizzle-orm/query-builders/select.types";

import { db } from "./client";
import {
  eveConversation,
  eveVote,
  eveFollowup,
  user,
  userModelPreference,
} from "./schema";

const hasQueryRow: (row: unknown) => boolean = Boolean;

const SINGLE_MATCH_LIMIT = 1;
const FIRST_RESULT_INDEX = 0;
type WriteTransaction = Readonly<
  Pick<typeof db, "select" | "execute" | "insert" | "delete" | "update">
>;

const getUserById = async ({
  userId,
}: {
  readonly userId: string;
}): Promise<User | undefined> => {
  const users = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(SINGLE_MATCH_LIMIT);
  return users[FIRST_RESULT_INDEX];
};

const getUserModelPreferences = async ({
  userId,
}: {
  readonly userId: string;
}): Promise<UserModelPreference[]> =>
  await db
    .select()
    .from(userModelPreference)
    .where(eq(userModelPreference.userId, userId));

const upsertUserModelPreference = async ({
  userId,
  modelId,
  enabled,
}: {
  readonly userId: string;
  readonly modelId: string;
  readonly enabled: boolean;
}): Promise<void> => {
  await db
    .insert(userModelPreference)
    .values({
      createdAt: new Date(),
      enabled,
      modelId,
      updatedAt: new Date(),
      userId,
    })
    .onConflictDoUpdate({
      set: { enabled, updatedAt: new Date() },
      target: [userModelPreference.userId, userModelPreference.modelId],
    });
};

/**
 * Reads vote state for messages in one bound conversation owned by the user.
 * Public sharing does not grant access to these owner-only votes.
 * @param {string} ownerId Owner whose vote state is requested.
 * @param {string} conversationId Bound conversation to read.
 * @returns {PromiseLike<Pick<typeof eveVote.$inferSelect, "isUpvoted" | "messageId">[]>} Lazy owner-filtered query. Await it or consume it with .then or .execute to read matching rows; Drizzle query methods remain available before consumption.
 */
const getEveMessageVotes = (
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
const saveEveMessageVote = async (
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

export {
  getEveMessageVotes,
  getUserById,
  getUserModelPreferences,
  saveEveMessageVote,
  upsertUserModelPreference,
};

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
