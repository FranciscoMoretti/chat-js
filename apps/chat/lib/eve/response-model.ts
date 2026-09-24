import type { MessageStreamEvent } from "eve/client";

/** First native model reference per turn, including inherited history. */
export const responseModelReferences = (
  events: readonly MessageStreamEvent[]
) => {
  const models = new Map<string, string>();
  for (const event of events) {
    const candidates =
      event.type === "history.restored" ? event.data.events : [event];
    for (const candidate of candidates) {
      if (
        candidate.type === "step.started" &&
        !models.has(candidate.data.turnId)
      ) {
        models.set(candidate.data.turnId, candidate.data.modelId);
      }
    }
  }
  return models;
};

/** Native responses require runtime evidence; imported responses retain provenance. */
export const responseModel = (
  events: readonly MessageStreamEvent[],
  turnId: string,
  importedModelId?: string
): string => {
  const reference = turnId
    ? responseModelReferences(events).get(turnId)
    : importedModelId;
  const separator = reference?.indexOf("/") ?? -1;
  if (reference && separator > 0 && separator < reference.length - 1) {
    return reference.slice(separator + 1);
  }
  throw new Error(
    "The response model is unavailable. Reload before regenerating."
  );
};
