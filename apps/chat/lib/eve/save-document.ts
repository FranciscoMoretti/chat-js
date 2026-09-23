import { Client } from "eve/client";
import type { z } from "zod";

import { config } from "../config";
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "../db/eve-documents";
import { getEveConversation } from "../db/eve-queries";
import { getEveConnectionOptions } from "./connection-options";
import { eveManualDocumentInput } from "./document-contracts";
import { documentHistoryTurns } from "./document-history";
import { assertEveConfigured } from "./server";

export const saveManualEveDocument = async (
  ownerId: string,
  value: z.input<typeof eveManualDocumentInput>
) => {
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
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const turns = documentHistoryTurns(snapshot.events);
  const saved = await saveEveDocumentRevision(
    {
      ...input,
      kind: previous.kind,
      operationId: `manual:${input.operationId}`,
      ownerId,
      turnIndex: null,
    },
    undefined,
    turns
  );
  return {
    content: saved.content,
    createdAt: saved.createdAt,
    documentId: saved.documentId,
    id: saved.id,
    kind: saved.kind,
    title: saved.title,
  };
};
