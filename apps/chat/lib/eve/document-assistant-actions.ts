import type {
  DocumentAssistantAction,
  DocumentAssistantRequest,
} from "./document-contracts";
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";
import { installedDocumentActions } from "@/tools/chatjs/document-actions";

const documentAssistantActions = (
  kind: "text" | "code" | "sheet"
): DocumentAssistantAction[] =>
  installedDocumentKinds.has(kind)
    ? (installedDocumentActions[kind]?.() ?? [])
    : [];

const documentAssistantRequest = (
  action: Readonly<ReturnType<typeof documentAssistantActions>[number]>,
  documentId: string,
  revisionId: string
): DocumentAssistantRequest => ({
  message: `${action.instruction}\n\nTarget document: ${documentId}. Selected revision: ${revisionId}. Use readDocument to read this document, then use the document tools to apply the requested changes.`,
  modelId: action.modelId,
});

export { documentAssistantActions, documentAssistantRequest };
