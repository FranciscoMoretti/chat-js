// Shared by Next.js and the standalone EVE server; env guards server credentials.
import type { PgSelectBase, PgSelectWithout } from "drizzle-orm/pg-core";
import type { User, UserModelPreference } from "./schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { GetSelectTableName } from "drizzle-orm/query-builders/select.types";

import { db } from "./client";
import {
  eveChat,
  eveChatProject,
  eveConversation,
  eveVote,
  eveFollowup,
  project,
  user,
  userModelPreference,
} from "./schema";

const hasQueryRow: (row: unknown) => boolean = Boolean;

const SINGLE_MATCH_LIMIT = 1;
const FIRST_RESULT_INDEX = 0;
type ProjectWriteTransaction = Readonly<
  Pick<typeof db, "select" | "execute" | "insert" | "delete" | "update">
>;

const createProject = ({
  id,
  userId,
  name,
  instructions = "",
  icon,
  iconColor,
}: {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly instructions?: string;
  readonly icon?: string;
  readonly iconColor?: string;
}): ReturnType<ReturnType<typeof db.insert<typeof project>>["values"]> =>
  db.insert(project).values({
    createdAt: new Date(),
    ...(typeof icon === "string" && icon !== "" && { icon }),
    ...(typeof iconColor === "string" && iconColor !== "" && { iconColor }),
    id,
    instructions,
    name,
    updatedAt: new Date(),
    userId,
  });

const getProjectsByUserId = ({
  userId,
}: {
  readonly userId: string;
}): PgSelectWithout<
  PgSelectBase<
    GetSelectTableName<typeof project>,
    (typeof project)["_"]["columns"],
    "single",
    Record<GetSelectTableName<typeof project>, "not-null">
  >,
  false,
  "where" | "orderBy"
> =>
  db
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.updatedAt));

const getProjectById = async ({
  id,
}: {
  readonly id: string;
}): Promise<typeof project.$inferSelect> => {
  const [selectedProject] = await db
    .select()
    .from(project)
    .where(eq(project.id, id));
  return selectedProject;
};

const updateProject = ({
  id,
  updates,
}: {
  readonly id: string;
  readonly updates: Partial<{
    readonly name: string;
    readonly instructions: string;
    readonly icon: string;
    readonly iconColor: string;
  }>;
}): ReturnType<
  ReturnType<ReturnType<typeof db.update<typeof project>>["set"]>["where"]
> =>
  db
    .update(project)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(project.id, id));

const deleteProject = ({
  id,
}: {
  readonly id: string;
}): ReturnType<ReturnType<typeof db.delete<typeof project>>["where"]> =>
  db.delete(project).where(eq(project.id, id));

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
  await db.transaction(async (tx: ProjectWriteTransaction) => {
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

const assignEveConversationProject = async (
  ownerId: string,
  routeId: string,
  projectId: string | null
): Promise<{ conversationId: string; projectId: string | null } | null> =>
  await db.transaction(async (tx: ProjectWriteTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [logicalChat] = await tx
      .select({ id: eveChat.id })
      .from(eveChat)
      .where(
        and(
          eq(eveChat.ownerId, ownerId),
          or(
            eq(eveChat.id, routeId),
            sql`exists (
              select 1 from "EveConversation" route_member
              where route_member."chatId" = ${eveChat.id}
                and route_member."ownerId" = ${ownerId}
                and route_member."id" = ${routeId}
            )`
          ),
          sql`exists (
            select 1 from "EveConversation" member
            where member."chatId" = ${eveChat.id}
              and member."ownerId" = ${ownerId}
              and member."state" = 'bound'
          )`
        )
      );
    if (!hasQueryRow(logicalChat)) {
      return null;
    }
    if (projectId === null) {
      await tx
        .delete(eveChatProject)
        .where(eq(eveChatProject.chatId, logicalChat.id));
    } else {
      const [target] = await tx
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, projectId), eq(project.userId, ownerId)))
        .for("key share");
      if (!hasQueryRow(target)) {
        return null;
      }
      await tx
        .insert(eveChatProject)
        .values({ chatId: logicalChat.id, ownerId, projectId })
        .onConflictDoUpdate({
          set: { projectId },
          target: eveChatProject.chatId,
        });
    }
    await tx
      .update(eveChat)
      .set({ updatedAt: new Date() })
      .where(eq(eveChat.id, logicalChat.id));
    return { conversationId: routeId, projectId };
  });
export {
  assignEveConversationProject,
  createProject,
  deleteProject,
  getEveMessageVotes,
  getProjectById,
  getProjectsByUserId,
  getUserById,
  getUserModelPreferences,
  saveEveMessageVote,
  updateProject,
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
