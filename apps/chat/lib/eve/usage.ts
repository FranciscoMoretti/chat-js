import type { MessageStreamEvent } from "eve/client";

import { recordEveUsage } from "../db/eve-billing";
import { registerEveSubagent } from "../db/eve-subagents";
import { toolResultSchema, hasEveToolReceipt } from "./tool-result";

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
      if (!call.failed && priced === false) {
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
      return;
    }
    const recordedCost = result.success ? result.data.usage.costUsd : undefined;
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
  return event.type === "step.failed" ? undefined : priced;
};
