import type { MessageStreamEvent } from "eve/client";

/** Native step events retain the selected model, including inherited turns. */
export function responseModel(
  events: readonly MessageStreamEvent[],
  turnId: string
): string {
  for (const event of events) {
    const candidates =
      event.type === "history.restored" ? event.data.events : [event];
    for (const candidate of candidates) {
      if (
        candidate.type === "step.started" &&
        candidate.data.turnId === turnId
      ) {
        // eve serializes a model reference as provider/modelId.
        const separator = candidate.data.modelId.indexOf("/");
        if (separator >= 0 && separator < candidate.data.modelId.length - 1) {
          return candidate.data.modelId.slice(separator + 1);
        }
      }
    }
  }
  throw new Error(
    "The response model is unavailable. Reload before regenerating."
  );
}
