import type {
  DocumentUi,
  DocumentUiRegistry,
} from "@/chatjs/core/documents/ui";
import { composeDocuments } from "@/chatjs/core/documents/document-definition";

export const composeDocumentViews = (
  views: readonly DocumentUi[]
): DocumentUiRegistry => {
  composeDocuments(views.map((view) => view.definition));
  return Object.fromEntries(views.map((view) => [view.definition.kind, view]));
};
