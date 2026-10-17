import type { ApprovalResponseContext } from "eve/tools/approval";
import type { ToolContext } from "eve/tools";
import { defineTool } from "eve/tools";
import { deleteDocumentInput } from "./schemas";
import type { z } from "zod";

import {
  getEveDocumentRevision,
  removeEveDocumentFromConversation,
} from "@/lib/db/eve-documents";
import { deleteDocumentAvailable } from "./availability";
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";

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

type Context = Readonly<
  Pick<ToolContext, "session" | "callId" | "approval"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

const scopeFor = async (
  context: Context
): ReturnType<typeof resolveEveConversationScope> => {
  if (!deleteDocumentAvailable(context.session)) {
    throw new Error("Document deletion is unavailable.");
  }
  return await resolveEveConversationScope(
    (context.session.auth.initiator ?? {}).principalId,
    context.session.id,
    context.abortSignal
  );
};
const requestDocumentDeletion = async (
  value: unknown,
  context: Context
): Promise<"user-approval"> => {
  const input = deleteDocumentInput.parse(value);
  const scope = await scopeFor(context);
  const revision = await getEveDocumentRevision(
    scope.ownerId,
    scope.conversationId,
    input.documentId
  );
  if (!revision || !installedDocumentKinds.has(revision.kind)) {
    throw new Error("Document not found.");
  }
  if (
    revision.id !== input.expectedRevisionId ||
    revision.title !== input.title
  ) {
    throw new Error(
      "Document changed. Read it again before requesting deletion."
    );
  }
  context.abortSignal.throwIfAborted();
  return "user-approval" as const;
};
const executeDocumentDeletion = async (
  input: Readonly<z.infer<typeof deleteDocumentInput>>,
  context: Context
): ReturnType<typeof removeEveDocumentFromConversation> => {
  const scope = await scopeFor(context);
  const { approval } = context;
  if (!approval || approval.responder.principalId !== scope.ownerId) {
    throw new Error("Document deletion requires the owner's approval.");
  }
  const revision = await getEveDocumentRevision(
    scope.ownerId,
    scope.conversationId,
    input.documentId
  );
  if (revision && !installedDocumentKinds.has(revision.kind)) {
    throw new Error("Document tools are disabled for this kind.");
  }
  return await removeEveDocumentFromConversation(
    input,
    scope,
    context.abortSignal
  );
};

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
