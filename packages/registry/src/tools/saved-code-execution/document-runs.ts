import type { EveMessage } from "eve/client";

import { documentExecutionInput } from "./schemas";

/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** Project the latest execution of this revision from the native transcript. */
// oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
export const latestDocumentRun = (
  messages: readonly EveMessage[],
  documentId: string,
  revisionId: string
) => {
  for (const message of messages.toReversed()) {
    for (const part of message.parts.toReversed()) {
      if (part.type !== "dynamic-tool" || part.toolName !== "runCodeDocument") {
        continue;
      }
      const input = documentExecutionInput.safeParse(part.input);
      if (
        input.success &&
        input.data.documentId === documentId &&
        input.data.revisionId === revisionId
      ) {
        return { messageId: message.id, part };
      }
    }
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable jsdoc/require-returns */
