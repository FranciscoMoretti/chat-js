import type { MessageStreamEvent } from "eve/client";

import { recordEveUsage } from "@/lib/db/eve-billing";
import { registerEveSubagent } from "@/lib/db/eve-subagents";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { hasEveToolReceipt, toolResultSchema } from "./tool-result";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ingestEveUsage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ingestEveUsage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types --
 * max-lines-per-function (#510): ingestEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): ingestEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): ingestEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): ingestEveUsage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): ingestEveUsage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): ingestEveUsage accepts event: MessageStreamEvent; attribution?: { sessionId: string; turnId: string }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
// oxlint-disable-next-line eslint/complexity -- Keep the atomic admission and validation branches together at this transaction boundary.
export const ingestEveUsage = async (
  ownerId: string,
  sessionId: string,
  event: MessageStreamEvent,
  attribution?: Readonly<{ sessionId: string; turnId: string }>
): Promise<boolean | undefined> => {
  if (event.type === "subagent.called" && !event.data.remote) {
    await registerEveSubagent(
      ownerId,
      sessionId,
      event.data.childSessionId,
      event.data.turnId
    );
    return undefined;
  }
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from attribution; preserve one receiver evaluation, skipped accesses and the existing sessionId fallback. The app guidance prefers optional chaining.
  const billingSession = attribution?.sessionId ?? sessionId;
  const eventId = attribution
    ? `eve-child:${sessionId}:${event.meta.id}`
    : event.meta.id;
  if (event.type === "hook.result") {
    let completedCallsPriced = true;
    for (const [index, call] of (event.data.modelCalls ?? []).entries()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Advance durable evidence in order without skipping unresolved work.
      const priced = await recordEveUsage({
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading costUsd from call.usage; preserve one receiver evaluation, skipped accesses and the existing (call.failed === true ? 0 : undefined) fallback. The app guidance prefers optional chaining.
        costUsd: call.usage?.costUsd ?? (call.failed === true ? 0 : undefined),
        eventId: `${eventId}:model-call:${index}`,
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading generationId from call.providerMetadata.gateway; read gateway from call.providerMetadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        generationId: call.providerMetadata?.gateway?.generationId,
        ownerId,
        sessionId: billingSession,
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading turnId from attribution; preserve one receiver evaluation, skipped accesses and the existing event.data.turnId fallback. The app guidance prefers optional chaining.
        turnId: attribution?.turnId ?? event.data.turnId,
      });
      if (call.failed !== true && !priced) {
        completedCallsPriced = false;
      }
    }
    return completedCallsPriced;
  }
  if (
    event.type === "action.result" &&
    event.data.result.kind === "tool-result"
  ) {
    const result = toolResultSchema.safeParse(event.data.result.output);
    if (!hasEveToolReceipt(event.data.result.output)) {
      return undefined;
    }
    const recordedCost = result.success ? result.data.usage.costUsd : undefined;
    return await recordEveUsage({
      costUsd: event.data.status === "rejected" ? 0 : recordedCost,
      eventId: `eve-tool:${sessionId}:${event.data.result.callId}`,
      ownerId,
      sessionId: billingSession,
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading turnId from attribution; preserve one receiver evaluation, skipped accesses and the existing event.data.turnId fallback. The app guidance prefers optional chaining.
      turnId: attribution?.turnId ?? event.data.turnId,
    });
  }
  if (
    event.type !== "step.completed" &&
    event.type !== "compaction.usage" &&
    event.type !== "step.failed"
  ) {
    return undefined;
  }
  const priced = await recordEveUsage({
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading costUsd from event.data.usage; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    costUsd: event.type === "step.failed" ? 0 : event.data.usage?.costUsd,
    eventId,
    generationId:
      event.type === "step.failed"
        ? undefined
        : // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading generationId from event.data.providerMetadata.gateway; read gateway from event.data.providerMetadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
          event.data.providerMetadata?.gateway?.generationId,
    ownerId,
    sessionId: billingSession,
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading turnId from attribution; preserve one receiver evaluation, skipped accesses and the existing event.data.turnId fallback. The app guidance prefers optional chaining.
    turnId: attribution?.turnId ?? event.data.turnId,
  });
  // A failed step has no completed-call usage receipt. Keep its evidence without
  // reporting a missing completed charge (the same policy used for failed hook calls).
  return event.type === "step.failed" ? undefined : priced;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types */
