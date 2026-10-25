// Shared by Next.js and the standalone EVE server; env guards server credentials.
import type { User, UserModelPreference } from "./schema";
import { and, eq } from "drizzle-orm";

import { db } from "./client";
import {
  eveConversation,
  eveFollowup,
  user,
  userModelPreference,
} from "./schema";

const SINGLE_MATCH_LIMIT = 1;
const FIRST_RESULT_INDEX = 0;
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

export { getUserById, getUserModelPreferences, upsertUserModelPreference };

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
