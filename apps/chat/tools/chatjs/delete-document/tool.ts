import { defineTool } from "eve/tools";

import { executeDocumentDeletion, requestDocumentDeletion } from "./execute";
import { deleteDocumentInput } from "./schemas";

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
