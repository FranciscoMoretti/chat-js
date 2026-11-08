import type { SessionStreamEvent } from "eve/client";

const responseModelReferences = (
  events: readonly SessionStreamEvent[]
): Map<string, string> => {
  const models = new Map<string, string>();
  for (const event of events) {
    if (
      event.type === "model.started" &&
      event.scope?.turnId !== undefined &&
      !models.has(event.scope.turnId)
    ) {
      models.set(event.scope.turnId, event.data.modelId);
    }
  }
  return models;
};

/** Native responses require runtime evidence; imported responses retain provenance.
 * @param {readonly SessionStreamEvent[]} events Native stream evidence used to resolve the turn's model reference.
 * @param {string} turnId Native turn identity, or an empty identity for an imported response.
 * @param {string | undefined} importedModelId Original model reference retained by an imported response.
 * @returns {string} The exact app-selected model ID recorded by the native model run.
 */
const responseModel = (
  events: readonly SessionStreamEvent[],
  turnId: string,
  importedModelId?: string
): string => {
  const reference = turnId
    ? responseModelReferences(events).get(turnId)
    : importedModelId;
  const separator = (reference ?? "").indexOf("/");
  if (
    typeof reference === "string" &&
    reference !== "" &&
    separator > 0 &&
    separator < reference.length - 1
  ) {
    return reference;
  }
  throw new Error(
    "The response model is unavailable. Reload before regenerating."
  );
};
export { responseModel, responseModelReferences };
