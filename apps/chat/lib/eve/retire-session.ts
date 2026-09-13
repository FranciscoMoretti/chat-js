import { Client } from "eve/client";

import { retireEveNativeSessions } from "../db/eve-native-purge";
import {
  beginEveConversationDeletion,
  getDeletingEveConversationForSession,
} from "../db/eve-queries";
import { env } from "../env";
import { assertEveConfigured } from "./server";
import { ingestEveUsage } from "./usage";

/** Retirement and cost settlement precede erasure; this never marks deletion complete. */
export async function retireEveSessionForDeletion(
  ownerId: string,
  sessionId: string
) {
  assertEveConfigured();
  if (!(await getDeletingEveConversationForSession(ownerId, sessionId))) {
    throw new Error("Conversation is not pending deletion.");
  }
  const client = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": ownerId, "x-chatjs-deletion": "1" },
  });
  const session = client.sessions.attach(sessionId);
  await session.reset({
    reason: "Conversation deleted",
    signal: AbortSignal.timeout(30_000),
  });
  const snapshot = await session.snapshot({
    signal: AbortSignal.timeout(15_000),
  });
  if (
    !snapshot.events.some(
      (event) =>
        event.type === "session.completed" || event.type === "session.failed"
    )
  ) {
    throw new Error("Session retirement has not completed. Retry cleanup.");
  }
  let unresolved = false;
  for (const event of snapshot.events) {
    if ((await ingestEveUsage(ownerId, sessionId, event)) === false) {
      unresolved = true;
    }
  }
  if (unresolved) {
    throw new Error(
      "Usage must be reconciled before conversation data can be erased."
    );
  }
  return snapshot;
}

/** Revoke family access and settle every bound member before resource erasure starts. */
export async function retireEveFamilyForDeletion(
  ownerId: string,
  conversationId: string
) {
  assertEveConfigured();
  const databaseUrl = env.WORKFLOW_POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("EVE Postgres is not configured.");
  }
  const family = await beginEveConversationDeletion(ownerId, conversationId);
  if (!family) {
    return undefined;
  }
  const sessionIds = family.conversations.map((conversation) => {
    if (!conversation.sessionId) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    return conversation.sessionId;
  });
  await retireEveNativeSessions(databaseUrl, sessionIds, async (sessionId) => {
    await retireEveSessionForDeletion(ownerId, sessionId);
  });
  return family;
}
