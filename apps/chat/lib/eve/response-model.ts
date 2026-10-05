import type { MessageStreamEvent } from "eve/client";

/** First native model reference per turn, including inherited history.
 * @param {readonly MessageStreamEvent[]} events Native stream events whose live and inherited steps carry model provenance.
 * @returns {Map<string, string>} The first recorded model reference for each native turn.
 */
const responseModelReferences = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native MessageStreamEvent includes recursive history/subagent collections; recursive readonly instantiation exceeds TypeScript limits and does not preserve native event assignability.
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

/** Native responses require runtime evidence; imported responses retain provenance.
 * @param {readonly MessageStreamEvent[]} events Native stream evidence used to resolve the turn's model reference.
 * @param {string} turnId Native turn identity, or an empty identity for an imported response.
 * @param {string | undefined} importedModelId Original model reference retained by an imported response.
 * @returns {string} The provider model ID after removing its gateway prefix.
 */
const responseModel = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native MessageStreamEvent includes recursive history/subagent collections; recursive readonly instantiation exceeds TypeScript limits and does not preserve native event assignability.
  events: readonly MessageStreamEvent[],
  turnId: string,
  importedModelId?: string
): string => {
  const reference = turnId
    ? responseModelReferences(events).get(turnId)
    : importedModelId;
  // oxlint-disable-next-line oxc/no-optional-chaining, no-magic-numbers -- Keep the existing nullish guard when reading indexOf from reference; preserve one receiver evaluation, skipped accesses and the existing -1 fallback. The app guidance prefers optional chaining.
  const separator = reference?.indexOf("/") ?? -1;
  /* oxlint-disable no-magic-numbers -- A provider separator must be after the first character and before the final character; slice starts one character after the slash. */
  if (
    typeof reference === "string" &&
    reference !== "" &&
    separator > 0 &&
    separator < reference.length - 1
  ) {
    return reference.slice(separator + 1);
  }
  /* oxlint-enable no-magic-numbers */
  throw new Error(
    "The response model is unavailable. Reload before regenerating."
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (responseModel, responseModelReferences); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { responseModel, responseModelReferences };
/* oxlint-enable import/no-named-export */
