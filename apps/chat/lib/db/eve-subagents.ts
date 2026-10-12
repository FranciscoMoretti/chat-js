import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "./client";
import { eveConversation, eveSubagentSession } from "./schema";

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
): Promise<EveSubagentBinding | undefined> => {
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
  const parent = hasQueryRow(root)
    ? undefined
    : await getEveSubagent(ownerId, parentSessionId);
  const conversationId = root?.id ?? parent?.conversationId;
  const rootTurnId = hasQueryRow(root) ? parentTurnId : parent?.rootTurnId;
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
    bound === undefined ||
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
        typeof rootSessionId === "string" && rootSessionId !== ""
          ? eq(eveConversation.sessionId, rootSessionId)
          : undefined
      )
    );

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

export {
  advanceEveSubagentUsageCursor,
  getEveSubagent,
  listEveSubagents,
  registerEveSubagent,
};
