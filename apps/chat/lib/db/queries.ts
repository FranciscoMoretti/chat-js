import "server-only";
import type { PgSelectBase, PgSelectWithout } from "drizzle-orm/pg-core";
import type { User, UserModelPreference } from "./schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { GetSelectTableName } from "drizzle-orm/query-builders/select.types";

import { db } from "./client";
/* oxlint-disable sort-imports -- The schema declaration is evaluated after the database client; client initializes the PostgreSQL pool on import. */
import {
  eveChat,
  eveChatProject,
  eveConversation,
  eveVote,
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (icon && { icon }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
    ...(typeof icon === "string" && icon !== "" && { icon }),
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (iconColor && { iconColor }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getProjectById's awaited sequencing and rejected-Promise behavior. */

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
/* oxlint-enable oxc/no-async-await */

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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing updates own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(project.id, id));

const deleteProject = ({
  id,
}: {
  readonly id: string;
}): ReturnType<ReturnType<typeof db.delete<typeof project>>["where"]> =>
  db.delete(project).where(eq(project.id, id));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getUserById's awaited sequencing and rejected-Promise behavior. */

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
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable typescript/promise-function-async --
typescript/promise-function-async (#606): getUserModelPreferences preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
const getUserModelPreferences = ({
  userId,
}: {
  readonly userId: string;
}): Promise<UserModelPreference[]> =>
  db
    .select()
    .from(userModelPreference)
    .where(eq(userModelPreference.userId, userId));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve upsertUserModelPreference's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */

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
/* oxlint-enable oxc/no-async-await */

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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveEveMessageVote's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-params, typescript/promise-function-async, unicorn/no-null --
max-params (#511): saveEveMessageVote keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.

typescript/promise-function-async (#606): saveEveMessageVote preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
unicorn/no-null (#570): saveEveMessageVote preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/**
 * Saves a message vote after validating the message against the native Eve snapshot.
 * The owner and bound-conversation check runs under the conversation-family lock.
 * @param {string} ownerId Owner submitting the vote.
 * @param {string} conversationId Bound conversation containing the message.
 * @param {string} messageId Native message ID being rated.
 * @param {boolean} isUpvoted Whether the message received a positive vote.
 * @returns {Promise<{ isUpvoted: boolean; messageId: string } | null>} The saved vote, or null when the conversation is no longer bound to the owner.
 */
const saveEveMessageVote = (
  ownerId: string,
  conversationId: string,
  messageId: string,
  isUpvoted: boolean
): Promise<Pick<
  typeof eveVote.$inferSelect,
  "isUpvoted" | "messageId"
> | null> =>
  db.transaction(async (tx: ProjectWriteTransaction) => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assignEveConversationProject's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params, typescript/promise-function-async, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, typescript/promise-function-async, unicorn/max-nested-calls, unicorn/no-null -- max-lines-per-function (#510): assignEveConversationProject keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): assignEveConversationProject keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.

typescript/promise-function-async (#606): assignEveConversationProject preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
unicorn/max-nested-calls (#568): assignEveConversationProject keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): assignEveConversationProject preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const assignEveConversationProject = (
  ownerId: string,
  routeId: string,
  projectId: string | null
): Promise<{ conversationId: string; projectId: string | null } | null> =>
  db.transaction(async (tx: ProjectWriteTransaction) => {
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (assignEveConversationProject, createProject, deleteProject, getEveMessageVotes, getProjectById, getProjectsByUserId, getUserById, getUserModelPreferences, saveEveMessageVote, updateProject, upsertUserModelPreference); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/promise-function-async, unicorn/max-nested-calls, unicorn/no-null */
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
