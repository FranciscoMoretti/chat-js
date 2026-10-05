import type { MessageStreamEvent } from "eve/client";

const MISSING_SEPARATOR_INDEX = -1;
const FIRST_CHARACTER_INDEX = 0;
const MODEL_SEPARATOR_LENGTH = 1;

/* oxlint-disable typescript/prefer-readonly-parameter-types --
typescript/prefer-readonly-parameter-types (#565): responseModelReferences accepts events: readonly MessageStreamEvent[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.  */
/** First native model reference per turn, including inherited history.
 * @param {readonly MessageStreamEvent[]} events Native stream events whose live and inherited steps carry model provenance.
 * @returns {Map<string, string>} The first recorded model reference for each native turn.
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

/* oxlint-disable typescript/prefer-readonly-parameter-types --
typescript/prefer-readonly-parameter-types (#565): responseModel accepts events: readonly MessageStreamEvent[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Native responses require runtime evidence; imported responses retain provenance.
 * @param {readonly MessageStreamEvent[]} events Native stream evidence used to resolve the turn's model reference.
 * @param {string} turnId Native turn identity, or an empty identity for an imported response.
 * @param {string | undefined} importedModelId Original model reference retained by an imported response.
 * @returns {string} The provider model ID after removing its gateway prefix.
 */
const responseModel = (
  events: readonly MessageStreamEvent[],
  turnId: string,
  importedModelId?: string
): string => {
  const reference = turnId
    ? responseModelReferences(events).get(turnId)
    : importedModelId;
  const separator = reference?.indexOf("/") ?? MISSING_SEPARATOR_INDEX;
  if (
    typeof reference === "string" &&
    reference !== "" &&
    separator > FIRST_CHARACTER_INDEX &&
    separator < reference.length - MODEL_SEPARATOR_LENGTH
  ) {
    return reference.slice(separator + MODEL_SEPARATOR_LENGTH);
  }
  throw new Error(
    "The response model is unavailable. Reload before regenerating."
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (responseModel, responseModelReferences); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { responseModel, responseModelReferences };
/* oxlint-enable import/no-named-export */
