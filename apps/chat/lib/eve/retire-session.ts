import { Client } from "eve/client";
import type { SessionSnapshot } from "eve/client";

/* oxlint-disable sort-imports -- Keep Eve's compiled Zod initialization before the DB/env graph loads external Zod; the documented global registry uses different constructor/prototype identities depending on which package initializes it first. */
import {
  beginEveConversationDeletion,
  getDeletingEveConversationForSession,
} from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */

import { assertEveConfigured } from "./server";
import { getEveConnectionOptions } from "./connection-options";
import { ingestEveUsage } from "./usage";
import { reconcileEveSubagentUsage } from "./reconcile-usage";
import { requireEveDeletionLifecycle } from "./deletion-lifecycle";

const SESSION_RETIRE_TIMEOUT_MS = 30_000;
const RETIRED_SNAPSHOT_TIMEOUT_MS = 15_000;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve retireEveSessionForDeletion's awaited sequencing and rejected-Promise behavior. */
const readRetiredSessionSnapshot = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original full native Client; recursive readonly mapping exceeds the SDK type instantiation limit.
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward original native events to ingestEveUsage; recursively projecting the full SDK event union exceeds TypeScript instantiation depth.
  events: Readonly<SessionSnapshot["events"]>
): Promise<void> => {
  let unresolved = false;
  for (const event of events) {
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
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- Preserve the original truthy deletion lookup guard; native SQL row destructuring can return undefined despite its declared nonnullable object type.
  if (!(await getDeletingEveConversationForSession(ownerId, sessionId))) {
    throw new Error("Conversation is not pending deletion.");
  }
  const connection = getEveConnectionOptions(ownerId);
  const client = new Client({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connection own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...connection,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connection.headers own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    headers: { ...connection.headers, "x-chatjs-deletion": "1" },
  });
  const snapshot = await readRetiredSessionSnapshot(client, sessionId);
  await reconcileRetiredSessionUsage(ownerId, sessionId, snapshot.events);
  return snapshot;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve retireEveFamilyForDeletion's awaited sequencing and rejected-Promise behavior. */

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
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- Preserve the original nullable session guard and separate later sessionId read while narrowing the original conversation.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (retireEveFamilyForDeletion, retireEveSessionForDeletion); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
export { retireEveFamilyForDeletion, retireEveSessionForDeletion };
/* oxlint-enable import/no-named-export */
