import type { MessageStreamEvent } from "eve/client";

import { recordEveUsage } from "@/lib/db/eve-billing";
import { registerEveSubagent } from "@/lib/db/eve-subagents";
/* oxlint-disable sort-imports -- Pinned Oxfmt places the local type declaration after database values and before the relative grouped import; sort-imports requires a different local-binding and binding-syntax order. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { hasEveToolReceipt, toolResultSchema } from "./tool-result";
/* oxlint-enable sort-imports */

/** Native evidence fields consumed by billing; tool output stays unknown until receipt validation. */
interface UsageEventData {
  "action.result": Pick<
    Extract<MessageStreamEvent, { type: "action.result" }>["data"],
    "status" | "turnId"
  > & {
    result:
      | (Pick<
          Extract<
            Extract<
              MessageStreamEvent,
              { type: "action.result" }
            >["data"]["result"],
            { kind: "tool-result" }
          >,
          "kind" | "callId"
        > & { output: unknown })
      | Pick<
          Exclude<
            Extract<
              MessageStreamEvent,
              { type: "action.result" }
            >["data"]["result"],
            { kind: "tool-result" }
          >,
          "kind"
        >;
  };
  "compaction.usage": Pick<
    Extract<MessageStreamEvent, { type: "compaction.usage" }>["data"],
    "usage" | "providerMetadata" | "turnId"
  >;
  "hook.result": Pick<
    Extract<MessageStreamEvent, { type: "hook.result" }>["data"],
    "modelCalls" | "turnId"
  >;
  "step.completed": Pick<
    Extract<MessageStreamEvent, { type: "step.completed" }>["data"],
    "usage" | "providerMetadata" | "turnId"
  >;
  "step.failed": Pick<
    Extract<MessageStreamEvent, { type: "step.failed" }>["data"],
    "turnId"
  >;
  "subagent.called": Pick<
    Extract<MessageStreamEvent, { type: "subagent.called" }>["data"],
    "remote" | "childSessionId" | "turnId"
  >;
}

/** Read original SDK event objects without claiming ownership of their unused recursive payloads. */
type UsageEventReader = ReadonlyNativeSurface<
  | {
      [EventType in keyof UsageEventData]: Pick<
        Extract<MessageStreamEvent, { type: EventType }>,
        "type" | "meta"
      > & { data: UsageEventData[EventType] };
    }[keyof UsageEventData]
  | (Pick<
      Exclude<MessageStreamEvent, { type: keyof UsageEventData }>,
      "type" | "meta"
    > & { data?: unknown })
>;

const NO_USAGE_COST_USD = 0;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ingestEveUsage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ingestEveUsage's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-undefined --
 * max-lines-per-function: This router handles subagent admission, ordered hook attempts, receipt-gated tool evidence and completed/failed step evidence; further workflow boundaries remain under review.
 * max-params: Preserve the positional owner/session/event/optional child-attribution ingestion API used by billing hooks and reconciliation; changing to an input object requires migrating those callers.
 * max-statements: Registration precedes billing dispatch, each hook attempt is awaited before advancing, and receipt/step branches retain distinct boolean versus absent results. Further routing boundaries remain under review.
 * no-undefined: No admitted usage or a failed step returns undefined; false specifically reports observed completed evidence without a price. Optional receipt costs likewise remain unpriced when absent.
 */
// oxlint-disable-next-line eslint/complexity -- Route subagent, hook, tool and step evidence with their existing distinct admission and pricing outcomes; these are sequential separate writes, not one atomic transaction.
export const ingestEveUsage = async (
  ownerId: string,
  sessionId: string,
  event: UsageEventReader,
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
  // oxlint-disable-next-line no-ternary -- Keep eventId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const eventId = attribution
    ? `eve-child:${sessionId}:${event.meta.id}`
    : event.meta.id;
  if (event.type === "hook.result") {
    let completedCallsPriced = true;
    for (const [index, call] of (event.data.modelCalls ?? []).entries()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Persist each model-attempt receipt before advancing; a rejected write must stop later attempts.
      const priced = await recordEveUsage({
        costUsd:
          // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading costUsd from call.usage; preserve one receiver evaluation and the failed-call fallback. The app guidance prefers optional chaining.
          call.usage?.costUsd ??
          // oxlint-disable-next-line no-ternary -- Keep the failed-call fallback lazy; if/else assignment conflicts with pinned unicorn/prefer-ternary.
          (call.failed === true ? NO_USAGE_COST_USD : undefined),
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
    // oxlint-disable-next-line no-ternary -- Keep recordedCost as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    const recordedCost = result.success ? result.data.usage.costUsd : undefined;
    return await recordEveUsage({
      costUsd:
        // oxlint-disable-next-line no-ternary -- Keep costUsd as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        event.data.status === "rejected" ? NO_USAGE_COST_USD : recordedCost,
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
    costUsd:
      // oxlint-disable-next-line no-ternary -- Failed steps use a zero-cost value; other events use optional usage. The selected value remains lazy.
      event.type === "step.failed"
        ? NO_USAGE_COST_USD
        : // oxlint-disable-next-line oxc/no-optional-chaining -- Step usage is optional and must remain undefined when absent; the app guidance prefers optional chaining.
          event.data.usage?.costUsd,
    eventId,
    generationId:
      // oxlint-disable-next-line no-ternary -- Keep generationId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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

  if (event.type === "step.failed") {
    return undefined;
  }
  return priced;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-undefined */
