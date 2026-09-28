import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "./client";
import { eveConversation, eveSubagentSession } from "./schema";

export const getEveSubagent = async (ownerId: string, sessionId: string) => {
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

/** Call only with native hook lineage or a trusted EVE subagent.called event. */
export const registerEveSubagent = async (
  ownerId: string,
  parentSessionId: string,
  sessionId: string,
  parentTurnId: string
) => {
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
  const parent = root
    ? undefined
    : await getEveSubagent(ownerId, parentSessionId);
  const conversationId = root?.id ?? parent?.conversationId;
  const rootTurnId = root ? parentTurnId : parent?.rootTurnId;
  if (!conversationId || !rootTurnId || sessionId === parentSessionId) {
    throw new Error("Native child has no owned parent conversation.");
  }
  await db
    .insert(eveSubagentSession)
    .values({ conversationId, ownerId, parentSessionId, rootTurnId, sessionId })
    .onConflictDoNothing();
  const bound = await getEveSubagent(ownerId, sessionId);
  if (
    !bound ||
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

export const listEveSubagents = async (
  ownerId: string,
  rootSessionId: string
) =>
  await db
    .select({
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
        eq(eveConversation.sessionId, rootSessionId)
      )
    );

export const advanceEveSubagentUsageCursor = async (
  ownerId: string,
  sessionId: string,
  streamIndex: number
) => {
  if (!Number.isSafeInteger(streamIndex) || streamIndex < 0) {
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
