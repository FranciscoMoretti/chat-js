import { defineTool } from "eve/tools";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { executeDocumentDeletion, requestDocumentDeletion } from "./execute";
/* oxlint-enable eslint/sort-imports */
import { deleteDocumentInput } from "./schemas";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export const deleteDocument = defineTool({
  approval: {
    request: (context) => requestDocumentDeletion(context.toolInput, context),
    response: ({ responder, session }) =>
      responder.principalId === session.initiator?.principalId
        ? { status: "allowed" }
        : {
            reason: "Only the document owner may approve deletion.",
            status: "rejected",
          },
  },
  description:
    "Request owner approval to remove a document from this conversation. Read it first and supply its exact title and revision. Call this tool to display the approval controls; do not ask for confirmation in a chat message. Execution waits for approval. Historical snapshots and other branches retain their copies; this does not permanently erase their content.",
  execute: executeDocumentDeletion,
  inputSchema: deleteDocumentInput,
});
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
