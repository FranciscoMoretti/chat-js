import { Client } from "eve/client";
import type { z } from "zod";

import { config } from "../config";
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "../db/eve-documents";
import { getEveConversation } from "../db/eve-queries";
import { env } from "../env";
import { eveManualDocumentInput } from "./document-contracts";
import { documentHistoryTurns } from "./document-history";
import { assertEveConfigured } from "./server";

export async function saveManualEveDocument(
  ownerId: string,
  value: z.input<typeof eveManualDocumentInput>
) {
  const input = eveManualDocumentInput.parse(value);
  const conversation = await getEveConversation(ownerId, input.conversationId);
  if (!(conversation?.sessionId && conversation.state === "bound")) {
    throw new Error("Conversation not found.");
  }
  const previous = await getEveDocumentRevision(
    ownerId,
    input.conversationId,
    input.documentId,
    input.expectedRevisionId
  );
  if (
    !(
      previous &&
      config.ai.tools.documents.enabled &&
      config.ai.tools.documents.types[previous.kind]
    )
  ) {
    throw new Error("Document not found.");
  }
  assertEveConfigured();
  const client = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": ownerId },
  });
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const turns = documentHistoryTurns(snapshot.events);
  const saved = await saveEveDocumentRevision(
    {
      ...input,
      ownerId,
      operationId: `manual:${input.operationId}`,
      kind: previous.kind,
      turnIndex: null,
    },
    undefined,
    turns
  );
  return {
    id: saved.id,
    documentId: saved.documentId,
    title: saved.title,
    content: saved.content,
    kind: saved.kind,
    createdAt: saved.createdAt,
  };
}
