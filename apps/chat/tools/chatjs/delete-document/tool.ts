import { defineTool } from "eve/tools";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { executeDocumentDeletion, requestDocumentDeletion } from "./execute";
/* oxlint-enable sort-imports */
import { deleteDocumentInput } from "./schemas";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (deleteDocument); the enabled import/no-default-export convention rejects the default-export alternative. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
