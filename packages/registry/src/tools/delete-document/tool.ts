import type { ApprovalResponseContext } from "eve/tools/approval";
import type { ToolContext } from "eve/tools";
import { defineTool } from "eve/tools";
// oxlint-disable-next-line sort-imports -- Preserve EVE definition-source Map initialization before the deletion executor initializes database/createEnv; native Multiple-before-Single sorting reverses the shared registry and validation-failure order.
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

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (deleteDocument); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export const deleteDocument = defineTool({
  approval: {
    request: (context: DeleteDocumentRequestContext) =>
      requestDocumentDeletion(context.toolInput, context),
    response: ({ responder, session }: DeleteDocumentResponseContext) => {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from session.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      if (responder.principalId === session.initiator?.principalId) {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/promise-function-async */
