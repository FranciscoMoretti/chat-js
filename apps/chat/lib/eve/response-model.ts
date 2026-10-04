import type { MessageStreamEvent } from "eve/client";

/* oxlint-disable typescript/prefer-readonly-parameter-types --
typescript/prefer-readonly-parameter-types (#565): responseModelReferences accepts events: readonly MessageStreamEvent[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.  */
/** First native model reference per turn, including inherited history.
 * @param events Native stream events whose live and inherited steps carry model provenance.
 * @returns The first recorded model reference for each native turn.
 */
const responseModelReferences = (
  events: readonly MessageStreamEvent[]
): Map<string, string> => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
no-magic-numbers (#517): responseModel uses -1, 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): responseModel accepts events: readonly MessageStreamEvent[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Native responses require runtime evidence; imported responses retain provenance.
 * @param events Native stream evidence used to resolve the turn's model reference.
 * @param turnId Native turn identity, or an empty identity for an imported response.
 * @param importedModelId Original model reference retained by an imported response.
 * @returns The provider model ID after removing its gateway prefix.
 */
const responseModel = (
  events: readonly MessageStreamEvent[],
  turnId: string,
  importedModelId?: string
): string => {
  const reference = turnId
    ? responseModelReferences(events).get(turnId)
    : importedModelId;
  const separator = reference?.indexOf("/") ?? -1;
  if (
    typeof reference === "string" &&
    reference !== "" &&
    separator > 0 &&
    separator < reference.length - 1
  ) {
    return reference.slice(separator + 1);
  }
  throw new Error(
    "The response model is unavailable. Reload before regenerating."
  );
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
export { responseModel, responseModelReferences };
