import type { ToolContext } from "eve/tools";
import type { z } from "zod";

import {
  getEveDocumentRevision,
  removeEveDocumentFromConversation,
} from "@/lib/db/eve-documents";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

import { deleteDocumentAvailable } from "./availability";
import { deleteDocumentInput } from "./schemas";

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
    context.session.auth.initiator?.principalId,
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
  if (context.approval?.responder.principalId !== scope.ownerId) {
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
export { executeDocumentDeletion, requestDocumentDeletion };
