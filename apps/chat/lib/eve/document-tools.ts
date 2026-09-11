import { createHash } from "node:crypto";
import type { ToolContext } from "eve/tools";
import { config } from "../config";
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "../db/eve-documents";
import { resolveEveConversationScope } from "./conversation-scope";
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentOperations,
  eveDocumentReadInput,
} from "./document-contracts";

type DocumentContext = Pick<ToolContext, "session" | "callId" | "abortSignal">;

/** Deterministic UUIDv8: retrying a create must address exactly the same document. */
function documentIdForCall(sessionId: string, callId: string) {
  const bytes = createHash("sha256")
    .update(JSON.stringify([sessionId, callId]))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] % 16) + 128;
  bytes[8] = (bytes[8] % 64) + 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function executeEveDocumentTool(
  name: string,
  value: unknown,
  context: DocumentContext
) {
  if (!config.ai.tools.documents.enabled) {
    throw new Error("Document tools are disabled.");
  }
  if (name === "readDocument") {
    const input = eveDocumentReadInput.parse(value);
    const scope = await resolveEveConversationScope(
      context.session.auth.initiator?.principalId,
      context.session.id,
      context.abortSignal
    );
    const revision = await getEveDocumentRevision(
      scope.ownerId,
      scope.conversationId,
      input.documentId
    );
    if (!(revision && config.ai.tools.documents.types[revision.kind])) {
      throw new Error("Document not found.");
    }
    return {
      status: "success",
      documentId: revision.documentId,
      revisionId: revision.id,
      title: revision.title,
      content: revision.content,
      kind: revision.kind,
      date: revision.createdAt.toISOString(),
    };
  }
  const operation = Object.entries(eveDocumentOperations).find(
    ([key]) => key === name
  )?.[1];
  if (!(operation && config.ai.tools.documents.types[operation.kind])) {
    throw new Error("Document tool is unavailable.");
  }
  const edit = operation.edit ? eveDocumentEditInput.parse(value) : undefined;
  const input = edit ?? eveDocumentCreateInput.parse(value);
  const scope = await resolveEveConversationScope(
    context.session.auth.initiator?.principalId,
    context.session.id,
    context.abortSignal
  );
  context.abortSignal.throwIfAborted();
  const revision = await saveEveDocumentRevision(
    {
      ...scope,
      documentId:
        edit?.documentId ??
        documentIdForCall(context.session.id, context.callId),
      expectedRevisionId: edit?.expectedRevisionId ?? null,
      operationId: `tool:${context.callId}`,
      turnIndex: context.session.turn.sequence,
      title: input.title,
      content: input.content,
      kind: operation.kind,
    },
    context.abortSignal
  );
  return {
    status: "success",
    documentId: revision.documentId,
    revisionId: revision.id,
    title: revision.title,
    kind: revision.kind,
    date: revision.createdAt.toISOString(),
    result: "Document saved.",
  };
}
