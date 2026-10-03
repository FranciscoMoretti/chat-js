/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-billing"; "../db/eve-subagents" dependency within this package instead of introducing an alias or barrel API.
 */
import type { MessageStreamEvent } from "eve/client";

import { recordEveUsage } from "../db/eve-billing";
import { registerEveSubagent } from "../db/eve-subagents";
import { toolResultSchema, hasEveToolReceipt } from "./tool-result";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): ingestEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): ingestEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): ingestEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): ingestEveUsage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): ingestEveUsage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep ingestEveUsage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep ingestEveUsage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): ingestEveUsage accepts event: MessageStreamEvent; attribution?: { sessionId: string; turnId: string }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): ingestEveUsage intentionally keeps the existing falsy-value behavior of call.failed; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
// oxlint-disable-next-line eslint/complexity -- Keep the atomic admission and validation branches together at this transaction boundary.
export const ingestEveUsage = async (
  ownerId: string,
  sessionId: string,
  event: MessageStreamEvent,
  attribution?: { sessionId: string; turnId: string }
) => {
  if (event.type === "subagent.called" && !event.data.remote) {
    await registerEveSubagent(
      ownerId,
      sessionId,
      event.data.childSessionId,
      event.data.turnId
    );
    return;
  }
  const billingSession = attribution?.sessionId ?? sessionId;
  const eventId = attribution
    ? `eve-child:${sessionId}:${event.meta.id}`
    : event.meta.id;
  if (event.type === "hook.result") {
    let completedCallsPriced = true;
    for (const [index, call] of (event.data.modelCalls ?? []).entries()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Advance durable evidence in order without skipping unresolved work.
      const priced = await recordEveUsage({
        costUsd: call.usage?.costUsd ?? (call.failed ? 0 : undefined),
        eventId: `${eventId}:model-call:${index}`,
        generationId: call.providerMetadata?.gateway?.generationId,
        ownerId,
        sessionId: billingSession,
        turnId: attribution?.turnId ?? event.data.turnId,
      });
      if (!call.failed && !priced) {
        completedCallsPriced = false;
      }
    }
    // oxlint-disable-next-line typescript/consistent-return -- #580: ingestEveUsage has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return completedCallsPriced;
  }
  if (
    event.type === "action.result" &&
    event.data.result.kind === "tool-result"
  ) {
    const result = toolResultSchema.safeParse(event.data.result.output);
    if (!hasEveToolReceipt(event.data.result.output)) {
      return;
    }
    const recordedCost = result.success ? result.data.usage.costUsd : undefined;
    // oxlint-disable-next-line typescript/consistent-return -- #580: ingestEveUsage has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return await recordEveUsage({
      costUsd: event.data.status === "rejected" ? 0 : recordedCost,
      eventId: `eve-tool:${sessionId}:${event.data.result.callId}`,
      ownerId,
      sessionId: billingSession,
      turnId: attribution?.turnId ?? event.data.turnId,
    });
  }
  if (
    event.type !== "step.completed" &&
    event.type !== "compaction.usage" &&
    event.type !== "step.failed"
  ) {
    return;
  }
  const priced = await recordEveUsage({
    costUsd: event.type === "step.failed" ? 0 : event.data.usage?.costUsd,
    eventId,
    generationId:
      event.type === "step.failed"
        ? undefined
        : event.data.providerMetadata?.gateway?.generationId,
    ownerId,
    sessionId: billingSession,
    turnId: attribution?.turnId ?? event.data.turnId,
  });
  // A failed step has no completed-call usage receipt. Keep its evidence without
  // reporting a missing completed charge (the same policy used for failed hook calls).
  // oxlint-disable-next-line typescript/consistent-return -- #580: ingestEveUsage has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return event.type === "step.failed" ? undefined : priced;
};
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
