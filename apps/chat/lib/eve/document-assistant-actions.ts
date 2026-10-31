import type {
  DocumentAssistantAction,
  DocumentAssistantRequest,
} from "./document-contracts";
import { installedDocumentKinds } from "@/integrations/tool-catalog";
import { documents } from "@/integrations/document-ui";

const documentAssistantActions = (kind: string): DocumentAssistantAction[] =>
  installedDocumentKinds.has(kind)
    ? (documents[kind]?.assistantActions?.() ?? [])
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
