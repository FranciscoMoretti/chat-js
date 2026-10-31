import type { SessionEvent as UsageEventReader } from "eve/client";
import { recordEveUsage } from "@/lib/db/eve-billing";
import { registerEveSubagent } from "@/lib/db/eve-subagents";

import { hasEveToolReceipt, toolResultSchema } from "./tool-result";
import {
  reportEveAccountingIssue,
  tryEveAccountingWrite,
} from "./accounting-log";



const NO_USAGE_COST_USD = 0;

const ingestToolUsage = async (
  ownerId: string,
  billingSession: string,
  sessionId: string,
  event: Extract<UsageEventReader, { type: "call.settled" }>,
  attribution?: Readonly<{ sessionId: string; turnId: string }>
): Promise<boolean> => {
  const result = toolResultSchema.safeParse(event.data.output);
  if (!hasEveToolReceipt(event.data.output)) {
    return true;
  }
  const recordedCost = result.success ? result.data.usage.costUsd : undefined;
  const turnId = attribution?.turnId ?? event.scope?.turnId;
  if (turnId === undefined || turnId === "") {
    return false;
  }
  const scope = {
    eventId: `eve-tool:${sessionId}:${event.data.callId}`,
    ownerId,
    sessionId: billingSession,
    turnId,
  };
  const priced = await tryEveAccountingWrite(
    scope,
    "tool-receipt",
    async () =>
      await recordEveUsage({
        costUsd:
          event.data.outcome === "rejected" ? NO_USAGE_COST_USD : recordedCost,
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
  const billingSession = attribution?.sessionId ?? sessionId;
  if (
    event.type === "child.opened" &&
    event.data.stream ===
      `/eve/v1/session/${encodeURIComponent(event.data.sessionId)}/stream`
  ) {
    const turnId = event.scope?.turnId;
    if (turnId === undefined || turnId === "") {
      return false;
    }
    await registerEveSubagent(ownerId, sessionId, event.data.sessionId, turnId);
  }

  if (event.type === "call.settled") {
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
