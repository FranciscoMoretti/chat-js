import type { ToolContext } from "eve/tools";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  getEveDocumentRevision,
  removeEveDocumentFromConversation,
} from "@/lib/db/eve-documents";
/* oxlint-enable sort-imports */
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { deleteDocumentAvailable } from "./availability";
/* oxlint-enable sort-imports */
import { deleteDocumentInput } from "./schemas";

type Context = Readonly<
  Pick<ToolContext, "session" | "callId" | "approval"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve scopeFor's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve requestDocumentDeletion's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeDocumentDeletion's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (executeDocumentDeletion, requestDocumentDeletion); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { executeDocumentDeletion, requestDocumentDeletion };
/* oxlint-enable import/no-named-export */
