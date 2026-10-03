/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/code-sandbox-name" dependency within this package instead of introducing an alias or barrel API.
 */
import { and, eq, sql } from "drizzle-orm";

import { eveCodeSandboxName } from "../eve/code-sandbox-name";
import { db } from "./client";
import { eveCodeSandbox, eveConversation } from "./schema";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): reserveEveCodeSandbox stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): reserveEveCodeSandbox's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): reserveEveCodeSandbox's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): reserveEveCodeSandbox keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): reserveEveCodeSandbox keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reserveEveCodeSandbox keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): reserveEveCodeSandbox accepts provider: { teamId: string; projectId: string; }; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): reserveEveCodeSandbox intentionally keeps the existing falsy-value behavior of conversation?.sessionId; existing; inserted; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Commit intent before provider I/O; no resource may be allocated by this function. */
export const reserveEveCodeSandbox = async (
  ownerId: string,
  conversationId: string,
  callId: string,
  provider: {
    teamId: string;
    projectId: string;
  }
): Promise<string> =>
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [conversation] = await tx
      .select({ sessionId: eveConversation.sessionId })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    if (!conversation?.sessionId) {
      throw new Error("Conversation is unavailable for code execution.");
    }
    const [existing] = await tx
      .select({ name: eveCodeSandbox.name })
      .from(eveCodeSandbox)
      .where(
        and(
          eq(eveCodeSandbox.ownerId, ownerId),
          eq(eveCodeSandbox.conversationId, conversationId),
          eq(eveCodeSandbox.callId, callId)
        )
      );
    if (existing) {
      throw new Error(
        "Reconcile the existing code sandbox before retrying allocation."
      );
    }
    const name = eveCodeSandboxName({
      callId,
      ownerId,
      provider,
      sessionId: conversation.sessionId,
    });
    const [inserted] = await tx
      .insert(eveCodeSandbox)
      .values({ callId, conversationId, name, ownerId })
      .onConflictDoNothing()
      .returning({ name: eveCodeSandbox.name });
    // Retrying provider creation is unsafe until the earlier allocation is reconciled.
    if (!inserted) {
      throw new Error(
        "Reconcile the existing code sandbox before retrying allocation."
      );
    }
    return inserted.name;
  });
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, typescript/strict-boolean-expressions --
 * import/group-exports (#523): recordEveCodeSandboxDeletion stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): recordEveCodeSandboxDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/strict-boolean-expressions (#610): recordEveCodeSandboxDeletion intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Internal coordinator only: caller must prove no pending allocation can finish later. */
export const recordEveCodeSandboxDeletion = async (
  ownerId: string,
  conversationId: string,
  name: string
): Promise<void> => {
  const [row] = await db
    .update(eveCodeSandbox)
    .set({ state: "deleted" })
    .where(
      and(
        eq(eveCodeSandbox.ownerId, ownerId),
        eq(eveCodeSandbox.conversationId, conversationId),
        eq(eveCodeSandbox.name, name)
      )
    )
    .returning({ name: eveCodeSandbox.name });
  if (!row) {
    throw new Error("Code sandbox ownership not found.");
  }
};
/* oxlint-enable import/group-exports, jsdoc/require-param, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, typescript/strict-boolean-expressions --
 * import/group-exports (#523): confirmEveCodeSandboxCreation stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): confirmEveCodeSandboxCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/strict-boolean-expressions (#610): confirmEveCodeSandboxCreation intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** A successful create reply proves this invocation has finished allocating. */
export const confirmEveCodeSandboxCreation = async (
  ownerId: string,
  conversationId: string,
  name: string
): Promise<void> => {
  const [row] = await db
    .update(eveCodeSandbox)
    .set({ creationConfirmed: true })
    .where(
      and(
        eq(eveCodeSandbox.ownerId, ownerId),
        eq(eveCodeSandbox.conversationId, conversationId),
        eq(eveCodeSandbox.name, name),
        eq(eveCodeSandbox.state, "unresolved")
      )
    )
    .returning({ name: eveCodeSandbox.name });
  if (!row) {
    throw new Error("Unresolved code sandbox ownership not found.");
  }
};
/* oxlint-enable import/group-exports, jsdoc/require-param, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/group-exports (#523): listEveCodeSandboxesForDeletion stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): listEveCodeSandboxesForDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): listEveCodeSandboxesForDeletion's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): listEveCodeSandboxesForDeletion uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep listEveCodeSandboxesForDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep listEveCodeSandboxesForDeletion's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
/** Internal cleanup inventory; unretired families cannot authorize provider deletion. */
export const listEveCodeSandboxesForDeletion = async (
  ownerId: string,
  rootId: string
) => {
  const family = await db
    .select({
      id: eveConversation.id,
      state: eveConversation.state,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.chatId, rootId)
      )
    );
  if (
    family.length === 0 ||
    family.some((row) => row.state !== "deleting" && row.state !== "deleted")
  ) {
    throw new Error(
      "Retire the conversation family before code sandbox cleanup."
    );
  }
  return await db
    .select({
      callId: eveCodeSandbox.callId,
      conversationId: eveCodeSandbox.conversationId,
      creationConfirmed: eveCodeSandbox.creationConfirmed,
      name: eveCodeSandbox.name,
      sessionId: eveConversation.sessionId,
    })
    .from(eveCodeSandbox)
    .innerJoin(
      eveConversation,
      eq(eveConversation.id, eveCodeSandbox.conversationId)
    )
    .where(
      and(
        eq(eveCodeSandbox.ownerId, ownerId),
        eq(eveCodeSandbox.state, "unresolved"),
        eq(eveConversation.chatId, rootId)
      )
    );
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
