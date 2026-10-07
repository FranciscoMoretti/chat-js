import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "./client";
import {
  eveChat,
  eveChatProject,
  eveConversation,
  eveVote,
  eveSubmission,
  eveMessageAnnotation,
  project,
  user,
  userModelPreference,
} from "./schema";
import type { User, UserModelPreference } from "./schema";

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
/* oxlint-enable max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/consistent-return, typescript/prefer-readonly-parameter-types --
 * max-lines-per-function: Keep the ordered dispatch/receipt or streaming scenario together so its evidence transitions remain reviewable.
 * max-statements: Keep the transaction or boundary scenario ordered; splitting its statements would hide the evidence transition.
 * no-magic-numbers: Protocol statuses, array positions and deterministic scenario counts are local to this boundary.
 * no-undefined: Undefined represents absent stream evidence or an optional query result; null is a persisted value.
 * typescript/consistent-return: Missing scoped evidence returns no result; valid receipts return the stored projection.
 * typescript/prefer-readonly-parameter-types: The Drizzle, EVE and Web Streams callbacks retain their SDK parameter types; the boundary does not mutate event data.
 */
// The immutable command is compared as JSONB, independent of object key order.
const reserveEveSubmission = async (
  input: Readonly<{
    ownerId: string;
    conversationId: string;
    operationId: string;
    command: unknown;
    selectedTool: string | null;
  }>
): Promise<typeof eveSubmission.$inferSelect> =>
  await db.transaction(async (tx) => {
    const [scope] = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, input.conversationId),
          eq(eveConversation.ownerId, input.ownerId),
          inArray(eveConversation.state, ["creating", "uncertain", "bound"])
        )
      )
      .for("share");
    if (scope === undefined) {
      throw new Error("Submission conversation is unavailable.");
    }
    await tx.insert(eveSubmission).values(input).onConflictDoNothing();
    const [row] = await tx
      .select()
      .from(eveSubmission)
      .where(
        and(
          eq(eveSubmission.ownerId, input.ownerId),
          eq(eveSubmission.operationId, input.operationId),
          eq(eveSubmission.conversationId, input.conversationId),
          sql`${eveSubmission.command} = ${JSON.stringify(input.command)}::jsonb`,
          sql`${eveSubmission.selectedTool} is not distinct from ${input.selectedTool}`
        )
      );
    if (row === undefined) {
      throw new Error(
        "Submission identity is already bound to another command."
      );
    }
    return row;
  });

// The CAS commits before network dispatch. Uncertain rows are never claimed again.
const claimEveSubmission = async (
  ownerId: string,
  operationId: string
): Promise<boolean> => {
  const [claimed] = await db
    .update(eveSubmission)
    .set({ state: "uncertain" })
    .where(
      and(
        eq(eveSubmission.ownerId, ownerId),
        eq(eveSubmission.operationId, operationId),
        eq(eveSubmission.state, "pending"),
        sql`exists (select 1 from ${eveConversation} where ${eveConversation.id} = ${eveSubmission.conversationId} and ${eveConversation.ownerId} = ${ownerId} and ${eveConversation.state} = 'bound')`
      )
    )
    .returning({ operationId: eveSubmission.operationId });
  return claimed !== undefined;
};

const settleEveSubmission = async (
  ownerId: string,
  operationId: string,
  state: "admitted" | "rejected"
): Promise<void> => {
  await db
    .update(eveSubmission)
    .set({ state })
    .where(
      and(
        eq(eveSubmission.ownerId, ownerId),
        eq(eveSubmission.operationId, operationId),
        inArray(
          eveSubmission.state,
          state === "admitted" ? ["pending", "uncertain"] : ["pending"]
        )
      )
    );
};

// Caller must have the native session_not_active response, not a timeout or cancellation.
const rejectEveSubmissionAdmission = async (
  ownerId: string,
  operationId: string
): Promise<void> => {
  await db
    .update(eveSubmission)
    .set({ state: "rejected" })
    .where(
      and(
        eq(eveSubmission.ownerId, ownerId),
        eq(eveSubmission.operationId, operationId),
        eq(eveSubmission.state, "uncertain")
      )
    );
};

const readEveSubmission = async (
  ownerId: string,
  sessionId: string,
  operationId: string
): Promise<typeof eveSubmission.$inferSelect | undefined> => {
  const [row] = await db
    .select({ submission: eveSubmission })
    .from(eveSubmission)
    .innerJoin(
      eveConversation,
      and(
        eq(eveConversation.id, eveSubmission.conversationId),
        eq(eveConversation.ownerId, eveSubmission.ownerId)
      )
    )
    .where(
      and(
        eq(eveSubmission.ownerId, ownerId),
        eq(eveSubmission.operationId, operationId),
        eq(eveConversation.sessionId, sessionId),
        eq(eveConversation.state, "bound")
      )
    );
  return row?.submission;
};

// Call only with an event read from the authenticated owner's exact native stream.
const recordEveMessageReceipt = async (
  input: Readonly<{
    ownerId: string;
    sessionId: string;
    messageId: string;
    operationIds: readonly string[];
    legacySelection: string | null;
    legacy: boolean;
  }>
): Promise<typeof eveMessageAnnotation.$inferSelect | undefined> =>
  await db.transaction(async (tx) => {
    const [scope] = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, input.ownerId),
          eq(eveConversation.sessionId, input.sessionId),
          eq(eveConversation.state, "bound")
        )
      )
      .for("share");
    if (scope === undefined) {
      return;
    }
    // Lock in stable UUID order; event order below still determines the last contributor.
    const submissions =
      input.operationIds.length === 0
        ? []
        : await tx
            .select()
            .from(eveSubmission)
            .where(
              and(
                eq(eveSubmission.ownerId, input.ownerId),
                eq(eveSubmission.conversationId, scope.id),
                inArray(eveSubmission.operationId, [...input.operationIds])
              )
            )
            .orderBy(eveSubmission.operationId)
            .for("update");
    const byOperation = new Map(
      submissions.map((row) => [row.operationId, row])
    );
    const contributors = input.operationIds.map((id) => byOperation.get(id));
    const exact =
      contributors.length > 0 &&
      contributors.every(
        (row) =>
          row !== undefined &&
          row.state !== "rejected" &&
          row.state !== "retired"
      );
    // Partial/foreign tokens cannot assign another owner's annotations or acknowledge a prefix.
    if (!exact && (submissions.length > 0 || !input.legacy)) {
      return;
    }
    const last = exact ? contributors.at(-1) : undefined;
    const annotation = {
      conversationId: scope.id,
      messageId: input.messageId,
      operationIds: exact ? [...input.operationIds] : [],
      ownerId: input.ownerId,
      selectedTool:
        last === undefined ? input.legacySelection : last.selectedTool,
      source: exact ? "submission" : "legacy",
    } satisfies typeof eveMessageAnnotation.$inferInsert;
    await tx
      .insert(eveMessageAnnotation)
      .values(annotation)
      .onConflictDoNothing();
    if (exact) {
      await tx
        .update(eveSubmission)
        .set({
          messageId: sql`coalesce(${eveSubmission.messageId}, ${input.messageId})`,
          state: "received",
        })
        .where(
          and(
            eq(eveSubmission.ownerId, input.ownerId),
            eq(eveSubmission.conversationId, scope.id),
            inArray(eveSubmission.operationId, [...input.operationIds])
          )
        );
    }
    const [stored] = await tx
      .select()
      .from(eveMessageAnnotation)
      .where(
        and(
          eq(eveMessageAnnotation.conversationId, scope.id),
          eq(eveMessageAnnotation.messageId, input.messageId)
        )
      );
    return stored;
  });

// Creation recovery still belongs to the pre-existing native allocation-operation contract.
const markEveCreationSubmissionDispatch = async (
  ownerId: string,
  operationId: string
): Promise<void> => {
  await db
    .update(eveSubmission)
    .set({ state: "uncertain" })
    .where(
      and(
        eq(eveSubmission.ownerId, ownerId),
        eq(eveSubmission.operationId, operationId),
        eq(eveSubmission.state, "pending")
      )
    );
};

export {
  assignEveConversationProject,
  claimEveSubmission,
  createProject,
  deleteProject,
  getEveMessageVotes,
  getProjectById,
  getProjectsByUserId,
  getUserById,
  getUserModelPreferences,
  markEveCreationSubmissionDispatch,
  readEveSubmission,
  rejectEveSubmissionAdmission,
  recordEveMessageReceipt,
  reserveEveSubmission,
  saveEveMessageVote,
  settleEveSubmission,
  updateProject,
  upsertUserModelPreference,
};

/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/consistent-return, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines -- This boundary keeps the existing query or proxy API and the new submission contract together. */
