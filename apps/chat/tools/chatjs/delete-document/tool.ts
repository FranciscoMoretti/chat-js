import type { ToolContext } from "eve/tools";
import { defineTool } from "eve/tools";
// oxlint-disable-next-line sort-imports -- Keep Oxfmt's module grouping: it places this approval type subpath after `eve/tools`, while sort-imports orders the imported binding name.
import type { ApprovalResponseContext } from "eve/tools/approval";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { executeDocumentDeletion, requestDocumentDeletion } from "./execute";
/* oxlint-enable sort-imports */
import { deleteDocumentInput } from "./schemas";

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
