import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "./client";
/* oxlint-disable sort-imports -- Keep db's env validation and postgres(connection) initialization before schema's pgTable construction. */
import { eveConversation, eveSubagentSession } from "./schema";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveSubagent's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

const FIRST_USAGE_STREAM_INDEX = 0;

const hasQueryRow: (row: unknown) => boolean = Boolean;

type EveSubagentBinding = Pick<
  typeof eveSubagentSession.$inferSelect,
  | "conversationId"
  | "parentSessionId"
  | "rootTurnId"
  | "sessionId"
  | "usageStreamIndex"
> & { rootSessionId: typeof eveConversation.$inferSelect.sessionId };

const getEveSubagent = async (
  ownerId: string,
  sessionId: string
): Promise<EveSubagentBinding> => {
  const [binding] = await db
    .select({
      conversationId: eveSubagentSession.conversationId,
      parentSessionId: eveSubagentSession.parentSessionId,
      rootSessionId: eveConversation.sessionId,
      rootTurnId: eveSubagentSession.rootTurnId,
      sessionId: eveSubagentSession.sessionId,
      usageStreamIndex: eveSubagentSession.usageStreamIndex,
    })
    .from(eveSubagentSession)
    .innerJoin(
      eveConversation,
      and(
        eq(eveConversation.id, eveSubagentSession.conversationId),
        eq(eveConversation.ownerId, eveSubagentSession.ownerId)
      )
    )
    .where(
      and(
        eq(eveSubagentSession.ownerId, ownerId),
        eq(eveSubagentSession.sessionId, sessionId),
        inArray(eveConversation.state, ["bound", "deleting"])
      )
    );
  return binding;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve registerEveSubagent's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-params, max-statements, no-undefined --
max-params (#511): registerEveSubagent keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): registerEveSubagent keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-undefined (#519): registerEveSubagent uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
*/
/**
 * Registers a native child session under an owned root conversation or subagent.
 * Existing lineage is checked after insertion so conflicting ownership fails.
 * Call only with native hook lineage or a trusted EVE subagent.called event.
 * @param {string} ownerId Owner of the root conversation.
 * @param {string} parentSessionId Native session ID of the root or parent subagent.
 * @param {string} sessionId Native session ID of the child being registered.
 * @param {string} parentTurnId Turn that launched the child from its direct parent.
 * @returns {Promise<NonNullable<Awaited<ReturnType<typeof getEveSubagent>>>>} The persisted child binding with its root conversation and turn.
 * @throws {Error} when the parent lineage is not owned or the child binding conflicts.
 */
const registerEveSubagent = async (
  ownerId: string,
  parentSessionId: string,
  sessionId: string,
  parentTurnId: string
): Promise<EveSubagentBinding> => {
  const [root] = await db
    .select({ id: eveConversation.id, sessionId: eveConversation.sessionId })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.sessionId, parentSessionId),
        inArray(eveConversation.state, ["bound", "deleting"])
      )
    );
  const parent =
    // oxlint-disable-next-line no-ternary -- Keep parent as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    hasQueryRow(root)
      ? undefined
      : await getEveSubagent(ownerId, parentSessionId);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from root; preserve one receiver evaluation, skipped accesses and the existing parent?.conversationId fallback. The app guidance prefers optional chaining. Keep the existing nullish guard when reading conversationId from parent; preserve one receiver evaluation, skipped accesses and the existing parent?.conversationId fallback. The app guidance prefers optional chaining.
  const conversationId = root?.id ?? parent?.conversationId;
  const rootTurnId =
    // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading rootTurnId from parent; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep rootTurnId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    hasQueryRow(root) ? parentTurnId : parent?.rootTurnId;
  if (
    !conversationId ||
    typeof rootTurnId !== "string" ||
    rootTurnId === "" ||
    sessionId === parentSessionId
  ) {
    throw new Error("Native child has no owned parent conversation.");
  }
  await db
    .insert(eveSubagentSession)
    .values({ conversationId, ownerId, parentSessionId, rootTurnId, sessionId })
    .onConflictDoNothing();
  const bound = await getEveSubagent(ownerId, sessionId);
  if (
    !hasQueryRow(bound) ||
    bound.conversationId !== conversationId ||
    bound.parentSessionId !== parentSessionId ||
    bound.rootTurnId !== rootTurnId
  ) {
    throw new Error(
      "Native child ownership changed. Research must start a fresh child session."
    );
  }
  return bound;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve listEveSubagents's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params, max-statements, no-undefined */

/* oxlint-disable no-undefined -- no-undefined (#519): listEveSubagents uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const listEveSubagents = async (
  ownerId: string,
  rootSessionId?: string
): Promise<
  Pick<
    EveSubagentBinding,
    "rootSessionId" | "rootTurnId" | "sessionId" | "usageStreamIndex"
  >[]
> =>
  await db
    .select({
      rootSessionId: eveConversation.sessionId,
      rootTurnId: eveSubagentSession.rootTurnId,
      sessionId: eveSubagentSession.sessionId,
      usageStreamIndex: eveSubagentSession.usageStreamIndex,
    })
    .from(eveSubagentSession)
    .innerJoin(
      eveConversation,
      and(
        eq(eveConversation.id, eveSubagentSession.conversationId),
        eq(eveConversation.ownerId, eveSubagentSession.ownerId)
      )
    )
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        // oxlint-disable-next-line no-ternary -- Keep and argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        typeof rootSessionId === "string" && rootSessionId !== ""
          ? eq(eveConversation.sessionId, rootSessionId)
          : undefined
      )
    );
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve advanceEveSubagentUsageCursor's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */

const advanceEveSubagentUsageCursor = async (
  ownerId: string,
  sessionId: string,
  streamIndex: number
): Promise<void> => {
  if (
    !Number.isSafeInteger(streamIndex) ||
    streamIndex < FIRST_USAGE_STREAM_INDEX
  ) {
    throw new Error("Invalid native child usage cursor.");
  }
  await db
    .update(eveSubagentSession)
    .set({
      usageStreamIndex: sql`greatest(${eveSubagentSession.usageStreamIndex}, ${streamIndex})`,
    })
    .where(
      and(
        eq(eveSubagentSession.ownerId, ownerId),
        eq(eveSubagentSession.sessionId, sessionId)
      )
    );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (advanceEveSubagentUsageCursor, getEveSubagent, listEveSubagents, registerEveSubagent); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */

export {
  advanceEveSubagentUsageCursor,
  getEveSubagent,
  listEveSubagents,
  registerEveSubagent,
};
/* oxlint-enable import/no-named-export */
