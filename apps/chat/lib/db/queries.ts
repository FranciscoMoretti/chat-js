import "server-only";
import { and, desc, eq, or, sql } from "drizzle-orm";

import { db } from "./client";
import {
  eveChat,
  eveChatProject,
  eveConversation,
  eveVote,
  project,
  user,
  userModelPreference,
} from "./schema";
import type { User, UserModelPreference } from "./schema";

export const createProject = ({
  id,
  userId,
  name,
  instructions = "",
  icon,
  iconColor,
}: {
  id: string;
  userId: string;
  name: string;
  instructions?: string;
  icon?: string;
  iconColor?: string;
}) =>
  db.insert(project).values({
    createdAt: new Date(),
    ...(icon && { icon }),
    ...(iconColor && { iconColor }),
    id,
    instructions,
    name,
    updatedAt: new Date(),
    userId,
  });

export const getProjectsByUserId = ({ userId }: { userId: string }) =>
  db
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.updatedAt));

export const getProjectById = async ({ id }: { id: string }) => {
  const [selectedProject] = await db
    .select()
    .from(project)
    .where(eq(project.id, id));
  return selectedProject;
};

export const updateProject = ({
  id,
  updates,
}: {
  id: string;
  updates: Partial<{
    name: string;
    instructions: string;
    icon: string;
    iconColor: string;
  }>;
}) =>
  db
    .update(project)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(project.id, id));

export const deleteProject = ({ id }: { id: string }) =>
  db.delete(project).where(eq(project.id, id));

export const getUserById = async ({
  userId,
}: {
  userId: string;
}): Promise<User | undefined> => {
  const users = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return users[0];
};

export const getUserModelPreferences = ({
  userId,
}: {
  userId: string;
}): Promise<UserModelPreference[]> =>
  db
    .select()
    .from(userModelPreference)
    .where(eq(userModelPreference.userId, userId));

export const upsertUserModelPreference = async ({
  userId,
  modelId,
  enabled,
}: {
  userId: string;
  modelId: string;
  enabled: boolean;
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

/** Feedback is owner-only, including when a conversation is publicly shared. */
export const getEveMessageVotes = (ownerId: string, conversationId: string) =>
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

/** Call only after validating the message against the native Eve snapshot. */
export const saveEveMessageVote = (
  ownerId: string,
  conversationId: string,
  messageId: string,
  isUpvoted: boolean
) =>
  db.transaction(async (tx) => {
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
    if (!conversation) {
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

export const assignEveConversationProject = (
  ownerId: string,
  routeId: string,
  projectId: string | null
) =>
  db.transaction(async (tx) => {
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
    if (!logicalChat) {
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
      if (!target) {
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
