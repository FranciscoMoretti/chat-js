import type { MessageStreamEvent } from "eve/client";

import { recordEveUsage } from "@/lib/db/eve-billing";
import { registerEveSubagent } from "@/lib/db/eve-subagents";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { hasEveToolReceipt, toolResultSchema } from "./tool-result";
import {
  reportEveAccountingIssue,
  tryEveAccountingWrite,
} from "./accounting-log";

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
  "agent.started": Pick<
    Extract<MessageStreamEvent, { type: "agent.started" }>["data"],
    "remote" | "sessionId" | "turnId"
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

const ingestToolUsage = async (
  ownerId: string,
  billingSession: string,
  sessionId: string,
  event: Extract<UsageEventReader, { type: "action.result" }>,
  attribution?: Readonly<{ sessionId: string; turnId: string }>
): Promise<boolean> => {
  if (event.data.result.kind !== "tool-result") {
    return true;
  }
  const result = toolResultSchema.safeParse(event.data.result.output);
  if (!hasEveToolReceipt(event.data.result.output)) {
    return true;
  }
  const recordedCost = result.success ? result.data.usage.costUsd : undefined;
  const scope = {
    eventId: `eve-tool:${sessionId}:${event.data.result.callId}`,
    ownerId,
    sessionId: billingSession,
    turnId: attribution?.turnId ?? event.data.turnId,
  };
  const priced = await tryEveAccountingWrite(
    scope,
    "tool-receipt",
    async () =>
      await recordEveUsage({
        costUsd:
          event.data.status === "rejected" ? NO_USAGE_COST_USD : recordedCost,
        ...scope,
      })
  );
  if (priced === false) {
    reportEveAccountingIssue(scope, "missing-cost");
  }
  return priced ?? false;
};

/** Returns whether this event permits the usage cursor to advance. Unpriced completed calls return false. */
export const ingestEveUsage = async (
  ownerId: string,
  sessionId: string,
  event: UsageEventReader,
  attribution?: Readonly<{ sessionId: string; turnId: string }>
): Promise<boolean> => {
  if (event.type === "agent.started" && !event.data.remote) {
    await registerEveSubagent(
      ownerId,
      sessionId,
      event.data.sessionId,
      event.data.turnId
    );
    return true;
  }
  const billingSession = attribution?.sessionId ?? sessionId;
  if (event.type === "action.result") {
    return await ingestToolUsage(
      ownerId,
      billingSession,
      sessionId,
      event,
      attribution
    );
  }
  // Model costs come only from durable wrapper intents and receipts.
  return true;
};
