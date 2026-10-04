/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-queries" dependency within this package instead of introducing an alias or barrel API.
 */
import { Client } from "eve/client";

import {
  beginEveConversationDeletion,
  getDeletingEveConversationForSession,
} from "../db/eve-queries";
import { getEveConnectionOptions } from "./connection-options";
import { requireEveDeletionLifecycle } from "./deletion-lifecycle";
import { reconcileEveSubagentUsage } from "./reconcile-usage";
import { assertEveConfigured } from "./server";
import { ingestEveUsage } from "./usage";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- jsdoc/require-param (#534): retireEveSessionForDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): retireEveSessionForDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-statements (#512): retireEveSessionForDeletion keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): retireEveSessionForDeletion uses 30_000, 15_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep retireEveSessionForDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep retireEveSessionForDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): retireEveSessionForDeletion accepts event; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): retireEveSessionForDeletion intentionally keeps the existing falsy-value behavior of await getDeletingEveConversationForSession(ownerId, sessionId); distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Retirement and cost settlement precede erasure; this never marks deletion complete. */
const retireEveSessionForDeletion = async (
  ownerId: string,
  sessionId: string
) => {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions -- jsdoc/require-param (#534): retireEveFamilyForDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): retireEveFamilyForDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep retireEveFamilyForDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep retireEveFamilyForDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/strict-boolean-expressions (#610): retireEveFamilyForDeletion intentionally keeps the existing falsy-value behavior of conversation.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Revoke family access and settle every bound member before resource erasure starts. */
const retireEveFamilyForDeletion = async (
  ownerId: string,
  conversationId: string
) => {
  assertEveConfigured();
  const lifecycle = await requireEveDeletionLifecycle();
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
export { retireEveFamilyForDeletion, retireEveSessionForDeletion };
