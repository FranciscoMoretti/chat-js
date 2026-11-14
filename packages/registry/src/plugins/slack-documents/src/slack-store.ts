import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { slackConversation, slackSession } from "./slack-schema";
import { slackActor } from "./slack-identity";
import type { SlackSession } from "./slack-identity";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const lockSlackWorkspace = async (
  tx: Pick<Transaction, "execute">,
  teamId: string
) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`chatjs:slack:${teamId}`}, 0))`
  );
};

/** Reserve the native address before dispatch; never allow another installation to enter its history. */
export const reserveSlackConversation = async (input: {
  teamId: string;
  channelId: string;
  threadTs: string;
  direct: boolean;
}) =>
  await db.transaction(async (tx) => {
    await tx.insert(slackConversation).values(input).onConflictDoNothing();
    const rows = await tx
      .select()
      .from(slackConversation)
      .where(
        and(
          eq(slackConversation.channelId, input.channelId),
          eq(slackConversation.threadTs, input.threadTs)
        )
      );
    const row = rows.at(0);
    if (
      row === undefined ||
      row.teamId !== input.teamId ||
      row.direct !== input.direct
    ) {
      throw new Error(
        "This native Slack thread is already bound to a different workspace or audience."
      );
    }
    return row;
  });
export const readSlackConversation = async (
  teamId: string,
  channelId: string,
  threadTs: string
) => {
  const rows = await db
    .select()
    .from(slackConversation)
    .where(
      and(
        eq(slackConversation.teamId, teamId),
        eq(slackConversation.channelId, channelId),
        eq(slackConversation.threadTs, threadTs)
      )
    );
  return rows.at(0);
};

export const bindSlackSession = async (session: SlackSession) => {
  const actor = slackActor(session);
  const conversation = await reserveSlackConversation({
    teamId: actor.teamId,
    channelId: actor.channelId,
    threadTs: actor.threadTs,
    direct: actor.direct,
  });
  if (conversation === undefined || conversation.direct !== actor.direct) {
    throw new Error("Slack session has no verified conversation binding.");
  }
  let rootSessionId = session.id;
  let rootTurnId: string | null = null;
  if (session.parent !== undefined) {
    const parents = await db
      .select()
      .from(slackSession)
      .where(eq(slackSession.sessionId, session.parent.sessionId));
    const parent = parents.at(0);
    if (
      parent === undefined ||
      parent.teamId !== actor.teamId ||
      parent.conversationId !== conversation.id
    ) {
      throw new Error("Slack subagent has no authorized parent binding.");
    }
    ({ rootSessionId } = parent);
    rootTurnId = parent.rootTurnId ?? session.parent.turn.id;
  }
  await db
    .insert(slackSession)
    .values({
      sessionId: session.id,
      teamId: actor.teamId,
      conversationId: conversation.id,
      rootSessionId,
      rootTurnId,
    })
    .onConflictDoNothing();
  const bindings = await db
    .select()
    .from(slackSession)
    .where(eq(slackSession.sessionId, session.id));
  const binding = bindings.at(0);
  if (
    binding === undefined ||
    binding.teamId !== actor.teamId ||
    binding.conversationId !== conversation.id ||
    binding.rootSessionId !== rootSessionId ||
    binding.rootTurnId !== rootTurnId
  ) {
    throw new Error("Slack session identity conflict.");
  }
  return { ...actor, ...binding };
};
