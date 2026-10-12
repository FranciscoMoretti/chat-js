import type { ApprovalResponseContext } from "eve/tools/approval";
import type { ToolContext } from "eve/tools";
import { defineTool } from "eve/tools";
import { executeDocumentDeletion, requestDocumentDeletion } from "./execute";
import { deleteDocumentInput } from "./schemas";
import type { z } from "zod";

type DeleteDocumentInput = z.infer<typeof deleteDocumentInput>;
type DeleteDocumentRequestContext = Readonly<
  Pick<ToolContext, "callId" | "session"> & {
    abortSignal: Readonly<AbortSignal>;
    toolInput?: Readonly<DeleteDocumentInput>;
  }
>;
type DeleteDocumentPrincipal = Readonly<
  Pick<ApprovalResponseContext<DeleteDocumentInput>["responder"], "principalId">
>;
type DeleteDocumentResponseContext = Readonly<
  Pick<ApprovalResponseContext<DeleteDocumentInput>, "responder"> & {
    session: Readonly<{
      initiator: DeleteDocumentPrincipal | null;
    }>;
  }
>;

export const deleteDocument = defineTool({
  approval: {
    request: async (context: DeleteDocumentRequestContext) =>
      await requestDocumentDeletion(context.toolInput, context),
    response: ({ responder, session }: DeleteDocumentResponseContext) => {
      if (responder.principalId === (session.initiator ?? {}).principalId) {
        return { status: "allowed" };
      }
      return {
        reason: "Only the document owner may approve deletion.",
        status: "rejected",
      };
    },
  },
  description:
    "Request owner approval to remove a document from this conversation. Read it first and supply its exact title and revision. Call this tool to display the approval controls; do not ask for confirmation in a chat message. Execution waits for approval. Historical snapshots and other branches retain their copies; this does not permanently erase their content.",
  execute: executeDocumentDeletion,
  inputSchema: deleteDocumentInput,
});
