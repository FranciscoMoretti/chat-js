import { Client } from "eve/client";
import type { SessionSnapshot } from "eve/client";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  beginEveConversationDeletion,
  getDeletingEveConversationForSession,
} from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */

import { getEveConnectionOptions } from "./connection-options";
import { requireEveDeletionLifecycle } from "./deletion-lifecycle";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { reconcileEveSubagentUsage } from "./reconcile-usage";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveConfigured } from "./server";
/* oxlint-enable sort-imports */
import { ingestEveUsage } from "./usage";

const SESSION_RETIRE_TIMEOUT_MS = 30_000;
const RETIRED_SNAPSHOT_TIMEOUT_MS = 15_000;

/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --max-statements (#512): retireEveSessionForDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): retireEveSessionForDeletion accepts event; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): retireEveSessionForDeletion intentionally keeps the existing falsy-value behavior of await getDeletingEveConversationForSession(ownerId, sessionId); distinguishing empty, zero, and absent states requires a domain behavior decision. */
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
  if (!(await getDeletingEveConversationForSession(ownerId, sessionId))) {
    throw new Error("Conversation is not pending deletion.");
  }
  const connection = getEveConnectionOptions(ownerId);
  const client = new Client({
    ...connection,
    headers: { ...connection.headers, "x-chatjs-deletion": "1" },
  });
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
      (event) =>
        event.type === "session.completed" || event.type === "session.failed"
    )
  ) {
    throw new Error("Session retirement has not completed. Retry cleanup.");
  }
  let unresolved = false;
  for (const event of snapshot.events) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Advance durable evidence in order without skipping unresolved work.
    if ((await ingestEveUsage(ownerId, sessionId, event)) === false) {
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
  return snapshot;
};
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/strict-boolean-expressions --typescript/strict-boolean-expressions (#610): retireEveFamilyForDeletion intentionally keeps the existing falsy-value behavior of databaseUrl; conversation.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
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
    return;
  }
  const sessionIds = family.conversations.map((conversation) => {
    if (!conversation.sessionId) {
      throw new Error("Resolve the missing session binding before cleanup.");
    }
    return conversation.sessionId;
  });
  await lifecycle.retire(sessionIds, async (sessionId) => {
    await retireEveSessionForDeletion(ownerId, sessionId);
  });
  // oxlint-disable-next-line typescript/consistent-return -- #580: retireEveFamilyForDeletion has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return family;
};
/* oxlint-enable typescript/strict-boolean-expressions */
export { retireEveFamilyForDeletion, retireEveSessionForDeletion };
