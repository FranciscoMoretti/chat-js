import type { MessageStreamEvent } from "eve/client";
import { recordEveUsage } from "../db/eve-billing";

export async function ingestEveUsage(
  ownerId: string,
  sessionId: string,
  event: MessageStreamEvent
) {
  if (event.type !== "step.completed" && event.type !== "step.failed") {
    return;
  }
  return await recordEveUsage({
    ownerId,
    sessionId,
    eventId: event.meta.id,
    turnId: event.data.turnId,
    costUsd:
      event.type === "step.completed" ? event.data.usage?.costUsd : undefined,
    generationId:
      event.type === "step.completed"
        ? event.data.providerMetadata?.gateway?.generationId
        : undefined,
  });
}
