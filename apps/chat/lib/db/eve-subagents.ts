import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "./client";
import { eveConversation, eveSubagentSession } from "./schema";

/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/group-exports (#523): getEveSubagent stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getEveSubagent API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): getEveSubagent sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getEveSubagent's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveSubagent's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
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
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-params, max-statements, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): registerEveSubagent stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named registerEveSubagent API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): registerEveSubagent's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): registerEveSubagent's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): registerEveSubagent keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): registerEveSubagent keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-ternary (#518): registerEveSubagent derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): registerEveSubagent uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): registerEveSubagent sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): registerEveSubagent handles optional root?.id; parent?.conversationId; parent?.rootTurnId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep registerEveSubagent's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep registerEveSubagent's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): registerEveSubagent intentionally keeps the existing falsy-value behavior of root; rootTurnId; bound; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-params, max-statements, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): listEveSubagents stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named listEveSubagents API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): listEveSubagents derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): listEveSubagents uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): listEveSubagents sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep listEveSubagents's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep listEveSubagents's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): listEveSubagents intentionally keeps the existing falsy-value behavior of rootSessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const listEveSubagents = async (
  ownerId: string,
  rootSessionId?: string
) =>
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
        rootSessionId ? eq(eveConversation.sessionId, rootSessionId) : undefined
      )
    );
/* oxlint-enable import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, no-magic-numbers  --
 * import/group-exports (#523): advanceEveSubagentUsageCursor stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named advanceEveSubagentUsageCursor API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): advanceEveSubagentUsageCursor uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): advanceEveSubagentUsageCursor sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
export const advanceEveSubagentUsageCursor = async (
  ownerId: string,
  sessionId: string,
  streamIndex: number
): Promise<void> => {
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
/* oxlint-enable import/group-exports, no-magic-numbers */
