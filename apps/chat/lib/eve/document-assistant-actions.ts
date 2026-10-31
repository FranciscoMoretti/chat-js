import type {
  DocumentAssistantAction,
  DocumentAssistantRequest,
} from "@/chatjs/core/documents/contracts";
import { installedDocumentKinds } from "@/integrations/tools/catalog";
import { documents } from "@/integrations/documents/ui";

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
