import type { MessageStreamEvent } from "eve/client";
import { recordEveUsage } from "../db/eve-billing";
import { evePlatformResult, isEvePlatformTool } from "./platform-result";

export async function ingestEveUsage(
  ownerId: string,
  sessionId: string,
  event: MessageStreamEvent
) {
  if (event.type === "hook.result") {
    let completedCallsPriced = true;
    for (const [index, call] of (event.data.modelCalls ?? []).entries()) {
      const priced = await recordEveUsage({
        ownerId,
        sessionId,
        eventId: `${event.meta.id}:model-call:${index}`,
        turnId: event.data.turnId,
        costUsd: call.usage?.costUsd,
        generationId: call.providerMetadata?.gateway?.generationId,
      });
      if (!call.failed && priced === false) {
        completedCallsPriced = false;
      }
    }
    return completedCallsPriced;
  }
  if (
    event.type === "action.result" &&
    event.data.result.kind === "tool-result" &&
    isEvePlatformTool(event.data.result.toolName)
  ) {
    const result = evePlatformResult.safeParse(event.data.result.output);
    const recordedCost = result.success ? result.data.usage.costUsd : undefined;
    return await recordEveUsage({
      ownerId,
      sessionId,
      eventId: `eve-tool:${sessionId}:${event.data.result.callId}`,
      turnId: event.data.turnId,
      costUsd: event.data.status === "rejected" ? 0 : recordedCost,
    });
  }
  if (
    event.type !== "step.completed" &&
    event.type !== "compaction.usage" &&
    event.type !== "step.failed"
  ) {
    return;
  }
  return await recordEveUsage({
    ownerId,
    sessionId,
    eventId: event.meta.id,
    turnId: event.data.turnId,
    costUsd:
      event.type === "step.failed" ? undefined : event.data.usage?.costUsd,
    generationId:
      event.type === "step.failed"
        ? undefined
        : event.data.providerMetadata?.gateway?.generationId,
  });
}
