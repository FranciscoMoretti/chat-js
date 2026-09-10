import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import type { ToolContext } from "eve/tools";
import { config } from "../config";
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "../db/eve-documents";
import { getBoundEveConversationForSession } from "../db/eve-queries";
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentOperations,
  eveDocumentReadInput,
} from "./document-contracts";

type DocumentContext = Pick<ToolContext, "session" | "callId" | "abortSignal">;

/** Only trusted native context determines the owner, conversation and fork boundary. */
async function conversationForTool(context: DocumentContext) {
  context.abortSignal.throwIfAborted();
  const ownerId = context.session.auth.initiator?.principalId;
  if (!ownerId) {
    throw new Error("Document tools require an authenticated owner.");
  }
  // A first-turn tool can start between native acceptance and app binding.
  // Never guess a reservation or authorize by a model-supplied conversation ID.
  for (let attempt = 0; attempt < 21; attempt++) {
    context.abortSignal.throwIfAborted();
    const conversation = await getBoundEveConversationForSession(
      ownerId,
      context.session.id
    );
    if (conversation) {
      return { ownerId, conversationId: conversation.id };
    }
    if (attempt < 20) {
      await setTimeout(250, undefined, { signal: context.abortSignal });
    }
  }
  throw new Error(
    "Conversation binding is not ready. Retry this document operation."
  );
}

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
    const scope = await conversationForTool(context);
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
  const scope = await conversationForTool(context);
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
