import { isNonEmptyString } from "@/lib/is-non-empty-string";

import { Client } from "eve/client";
import type { SessionSnapshot } from "eve/client";

import {
  beginEveConversationDeletion,
  getDeletingEveConversationForSession,
} from "@/lib/db/eve-queries";

import { assertEveConfigured } from "./server";
import { getEveConnectionOptions } from "./connection-options";
import { ingestEveUsage } from "./usage";
import { reconcileEveSubagentUsage } from "./reconcile-usage";
import { requireEveDeletionLifecycle } from "./deletion-lifecycle";

const SESSION_RETIRE_TIMEOUT_MS = 30_000;
const RETIRED_SNAPSHOT_TIMEOUT_MS = 15_000;

const readRetiredSessionSnapshot = async (
  client: Readonly<Client>,
  sessionId: string
): Promise<SessionSnapshot> => {
  const session = client.sessions.attach(sessionId);
  await session.reset({
    reason: "Conversation deleted",
    signal: AbortSignal.timeout(SESSION_RETIRE_TIMEOUT_MS),
  });
  const snapshot = await session.snapshot({
    signal: AbortSignal.timeout(RETIRED_SNAPSHOT_TIMEOUT_MS),
  });
  if (
    !snapshot.events.some(
      (event: { readonly type: string }) =>
        event.type === "session.completed" || event.type === "session.failed"
    )
  ) {
    throw new Error("Session retirement has not completed. Retry cleanup.");
  }
  return snapshot;
};

const reconcileRetiredSessionUsage = async (
  ownerId: string,
  sessionId: string,
  events: Readonly<SessionSnapshot["events"]>
): Promise<void> => {
  let unresolved = false;
  for (const event of events) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Ingest snapshot events in native order before subagent reconciliation; unresolved costs prevent retirement receipts and payload erasure.
    if (!(await ingestEveUsage(ownerId, sessionId, event))) {
      unresolved = true;
    }
  }
  if (!(await reconcileEveSubagentUsage(ownerId, sessionId))) {
    unresolved = true;
  }
  if (unresolved) {
    throw new Error(
      "Usage must be reconciled before conversation data can be erased."
    );
  }
};

/**
 * Retires a deletion-pending session and settles its usage before erasure is allowed.
 * @param {string} ownerId Owner authorized by the conversation's deletion state.
 * @param {string} sessionId Bound native session to reset and inspect for terminal evidence.
 * @returns {Promise<SessionSnapshot>} The terminal snapshot after direct and subagent usage are reconciled; incomplete retirement throws.
 */
const retireEveSessionForDeletion = async (
  ownerId: string,
  sessionId: string
): Promise<SessionSnapshot> => {
  assertEveConfigured();

  if (
    (await getDeletingEveConversationForSession(ownerId, sessionId)) === null
  ) {
    throw new Error("Conversation is not pending deletion.");
  }
  const connection = getEveConnectionOptions(ownerId);
  const client = new Client({
    ...connection,
    headers: { ...connection.headers, "x-chatjs-deletion": "1" },
  });
  const snapshot = await readRetiredSessionSnapshot(client, sessionId);
  await reconcileRetiredSessionUsage(ownerId, sessionId, snapshot.events);
  return snapshot;
};

/**
 * Revokes family access and settles every bound session before resource erasure starts.
 * @param {string} ownerId Owner whose conversation family is placed into deletion state.
 * @param {string} conversationId Conversation identifying the family whose bound sessions are retired.
 * @returns {Promise< | NonNullable<Awaited<ReturnType<typeof beginEveConversationDeletion>>> | undefined >} The deletion family after session retirement, or no result when no family is available.
 */
const retireEveFamilyForDeletion = async (
  ownerId: string,
  conversationId: string
): Promise<
  | NonNullable<Awaited<ReturnType<typeof beginEveConversationDeletion>>>
  | undefined
> => {
  assertEveConfigured();
  const lifecycle = requireEveDeletionLifecycle();
  await lifecycle.check();
  const family = await beginEveConversationDeletion(ownerId, conversationId);
  if (!family) {
    return undefined;
  }
  const sessionIds = family.conversations.map((conversation) => {
    if (!isNonEmptyString(conversation.sessionId)) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    return conversation.sessionId;
  });
  await lifecycle.retire(sessionIds, async (sessionId) => {
    await retireEveSessionForDeletion(ownerId, sessionId);
  });
  return family;
};
export { retireEveFamilyForDeletion, retireEveSessionForDeletion };
