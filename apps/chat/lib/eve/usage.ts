import type { MessageStreamEvent } from "eve/client";

import { recordEveUsage } from "@/lib/db/eve-billing";
import { registerEveSubagent } from "@/lib/db/eve-subagents";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { hasEveToolReceipt, toolResultSchema } from "./tool-result";

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

const ingestHookUsage = async (
  ownerId: string,
  billingSession: string,
  eventId: string,
  event: Extract<UsageEventReader, { type: "hook.result" }>,
  attribution?: Readonly<{ sessionId: string; turnId: string }>
): Promise<boolean> => {
  let completedCallsPriced = true;
  for (const [index, call] of (event.data.modelCalls ?? []).entries()) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Persist each model-attempt receipt before the next; a rejected ledger write must stop later attempts and unresolved completed calls prevent cursor advance.
    const priced = await recordEveUsage({
      costUsd:
        call.usage?.costUsd ??
        (call.failed === true ? NO_USAGE_COST_USD : undefined),
      eventId: `${eventId}:model-call:${index}`,
      generationId: call.providerMetadata?.gateway?.generationId,
      ownerId,
      sessionId: billingSession,
      turnId: attribution?.turnId ?? event.data.turnId,
    });
    if (call.failed !== true && !priced) {
      completedCallsPriced = false;
    }
  }
  return completedCallsPriced;
};

const ingestToolUsage = async (
  ownerId: string,
  billingSession: string,
  sessionId: string,
  event: Extract<UsageEventReader, { type: "action.result" }>,
  attribution?: Readonly<{ sessionId: string; turnId: string }>
): Promise<boolean | undefined> => {
  if (event.data.result.kind !== "tool-result") {
    return undefined;
  }
  const result = toolResultSchema.safeParse(event.data.result.output);
  if (!hasEveToolReceipt(event.data.result.output)) {
    return undefined;
  }
  const recordedCost = result.success ? result.data.usage.costUsd : undefined;
  return await recordEveUsage({
    costUsd:
      event.data.status === "rejected" ? NO_USAGE_COST_USD : recordedCost,
    eventId: `eve-tool:${sessionId}:${event.data.result.callId}`,
    ownerId,
    sessionId: billingSession,
    turnId: attribution?.turnId ?? event.data.turnId,
  });
};

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
  const billingSession = attribution?.sessionId ?? sessionId;
  const eventId = attribution
    ? `eve-child:${sessionId}:${event.meta.id}`
    : event.meta.id;
  if (event.type === "hook.result") {
    return await ingestHookUsage(
      ownerId,
      billingSession,
      eventId,
      event,
      attribution
    );
  }
  if (event.type === "action.result") {
    return await ingestToolUsage(
      ownerId,
      billingSession,
      sessionId,
      event,
      attribution
    );
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
      event.type === "step.failed"
        ? NO_USAGE_COST_USD
        : event.data.usage?.costUsd,
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

  if (event.type === "step.failed") {
    return undefined;
  }
  return priced;
};
