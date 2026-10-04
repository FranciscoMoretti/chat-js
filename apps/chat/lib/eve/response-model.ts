import type { MessageStreamEvent } from "eve/client";

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- jsdoc/require-param (#534): responseModelReferences's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): responseModelReferences's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep responseModelReferences's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep responseModelReferences's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): responseModelReferences accepts events: readonly MessageStreamEvent[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** First native model reference per turn, including inherited history. */
const responseModelReferences = (events: readonly MessageStreamEvent[]) => {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- jsdoc/require-param (#534): responseModel's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): responseModel's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
no-magic-numbers (#517): responseModel uses -1, 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): responseModel accepts events: readonly MessageStreamEvent[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): responseModel intentionally keeps the existing falsy-value behavior of reference; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Native responses require runtime evidence; imported responses retain provenance. */
const responseModel = (
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
export { responseModel, responseModelReferences };
