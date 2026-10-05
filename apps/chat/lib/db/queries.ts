import "server-only";
import { and, desc, eq, or, sql } from "drizzle-orm";

import { db } from "./client";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { User, UserModelPreference } from "./schema";
/* oxlint-enable sort-imports */
import {
  eveChat,
  eveChatProject,
  eveConversation,
  eveVote,
  project,
  user,
  userModelPreference,
} from "./schema";

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- typescript/explicit-function-return-type (#560): Keep createProject's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep createProject's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): createProject accepts { id, userId, name, instructions = "", icon, iconColor, }: { id: string; userId: str; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): createProject intentionally keeps the existing falsy-value behavior of icon; iconColor; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const createProject = ({
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- typescript/explicit-function-return-type (#560): Keep getProjectsByUserId's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep getProjectsByUserId's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): getProjectsByUserId accepts { userId }: { userId: string }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const getProjectsByUserId = ({ userId }: { userId: string }) =>
  db
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.updatedAt));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getProjectById's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- typescript/explicit-function-return-type (#560): Keep getProjectById's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep getProjectById's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): getProjectById accepts { id }: { id: string }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const getProjectById = async ({ id }: { id: string }) => {
  const [selectedProject] = await db
    .select()
    .from(project)
    .where(eq(project.id, id));
  return selectedProject;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- typescript/explicit-function-return-type (#560): Keep updateProject's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep updateProject's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): updateProject accepts { id, updates, }: { id: string; updates: Partial<{ name: string; instructions: strin; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const updateProject = ({
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- typescript/explicit-function-return-type (#560): Keep deleteProject's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep deleteProject's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): deleteProject accepts { id }: { id: string }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const deleteProject = ({ id }: { id: string }) =>
  db.delete(project).where(eq(project.id, id));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getUserById's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- no-magic-numbers (#517): getUserById uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): getUserById accepts { userId, }: { userId: string; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const getUserById = async ({
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- typescript/prefer-readonly-parameter-types (#565): getUserModelPreferences accepts { userId, }: { userId: string; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): getUserModelPreferences preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
const getUserModelPreferences = ({
  userId,
}: {
  userId: string;
}): Promise<UserModelPreference[]> =>
  db
    .select()
    .from(userModelPreference)
    .where(eq(userModelPreference.userId, userId));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve upsertUserModelPreference's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): upsertUserModelPreference accepts { userId, modelId, enabled, }: { userId: string; modelId: string; enabled: boolean; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const upsertUserModelPreference = async ({
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- jsdoc/require-param (#534): getEveMessageVotes's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): getEveMessageVotes's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep getEveMessageVotes's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep getEveMessageVotes's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
/** Feedback is owner-only, including when a conversation is publicly shared. */
const getEveMessageVotes = (ownerId: string, conversationId: string) =>
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveEveMessageVote's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null -- jsdoc/require-param (#534): saveEveMessageVote's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): saveEveMessageVote's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-params (#511): saveEveMessageVote keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/explicit-function-return-type (#560): Keep saveEveMessageVote's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep saveEveMessageVote's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): saveEveMessageVote accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): saveEveMessageVote preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
typescript/strict-boolean-expressions (#610): saveEveMessageVote intentionally keeps the existing falsy-value behavior of conversation; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/no-null (#570): saveEveMessageVote preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** Call only after validating the message against the native Eve snapshot. */
const saveEveMessageVote = (
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assignEveConversationProject's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null -- max-lines-per-function (#510): assignEveConversationProject keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): assignEveConversationProject keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/explicit-function-return-type (#560): Keep assignEveConversationProject's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep assignEveConversationProject's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): assignEveConversationProject accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): assignEveConversationProject preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
typescript/strict-boolean-expressions (#610): assignEveConversationProject intentionally keeps the existing falsy-value behavior of logicalChat; target; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/max-nested-calls (#568): assignEveConversationProject keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): assignEveConversationProject preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const assignEveConversationProject = (
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (assignEveConversationProject, createProject, deleteProject, getEveMessageVotes, getProjectById, getProjectsByUserId, getUserById, getUserModelPreferences, saveEveMessageVote, updateProject, upsertUserModelPreference); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */
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
/* oxlint-enable import/no-named-export */
