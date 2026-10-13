import { Client } from "eve/client";
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "@/lib/db/eve-documents";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { assertEveConfigured } from "./server";
import { documentHistoryTurns } from "./document-history";
import { eveManualDocumentInput } from "./document-contracts";
import { getEveConnectionOptions } from "./connection-options";
import { getEveConversation } from "@/lib/db/eve-queries";
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";
import type { z } from "zod";

const documentSnapshotTimeoutMs = 15_000;

type SavedDocumentReceipt = Pick<
  Awaited<ReturnType<typeof saveEveDocumentRevision>>,
  "content" | "createdAt" | "documentId" | "id" | "kind" | "title"
>;

const savedDocumentReceipt = (
  saved: ReadonlyNativeSurface<SavedDocumentReceipt>
): SavedDocumentReceipt => ({
  content: saved.content,
  createdAt: saved.createdAt,
  documentId: saved.documentId,
  id: saved.id,
  kind: saved.kind,
  title: saved.title,
});

type BoundManualConversation = ReadonlyNativeSurface<
  NonNullable<Awaited<ReturnType<typeof getEveConversation>>>
> & { readonly sessionId: string; readonly state: "bound" };

interface ManualDocumentContext {
  readonly conversation: BoundManualConversation;
  readonly previous: NonNullable<
    Awaited<ReturnType<typeof getEveDocumentRevision>>
  >;
}

const isBoundManualConversation = (
  conversation: ReadonlyNativeSurface<
    Awaited<ReturnType<typeof getEveConversation>>
  >
): conversation is BoundManualConversation =>
  !(
    !conversation ||
    (conversation.sessionId ?? "") === "" ||
    conversation.state !== "bound"
  );

const resolveManualDocumentContext = async (
  ownerId: string,
  input: ReadonlyNativeSurface<z.output<typeof eveManualDocumentInput>>
): Promise<ManualDocumentContext> => {
  const conversation = await getEveConversation(ownerId, input.conversationId);
  if (!isBoundManualConversation(conversation)) {
    throw new Error("Conversation not found.");
  }
  const previous = await getEveDocumentRevision(
    ownerId,
    input.conversationId,
    input.documentId,
    input.expectedRevisionId
  );
  if (!(previous && installedDocumentKinds.has(previous.kind))) {
    throw new Error("Document not found.");
  }
  return { conversation, previous };
};

export const saveManualEveDocument = async (
  ownerId: string,
  value: ReadonlyNativeSurface<z.input<typeof eveManualDocumentInput>>
): Promise<SavedDocumentReceipt> => {
  const input = eveManualDocumentInput.parse(value);
  const { conversation, previous } = await resolveManualDocumentContext(
    ownerId,
    input
  );
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot({ signal: AbortSignal.timeout(documentSnapshotTimeoutMs) });
  const turns = documentHistoryTurns(snapshot.events);
  const saved = await saveEveDocumentRevision(
    {
      ...input,
      fileIds: [...new Set([...previous.fileIds, ...input.fileIds])],
      kind: previous.kind,
      operationId: `manual:${input.operationId}`,
      ownerId,
      turnIndex: null,
    },
    undefined,
    turns
  );
  return savedDocumentReceipt(saved);
};
