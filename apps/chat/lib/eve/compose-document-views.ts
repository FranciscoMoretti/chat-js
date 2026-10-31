import type { DocumentUi, DocumentUiRegistry } from "./document-ui";
import { composeDocuments } from "./document-definition";

export const composeDocumentViews = (
  views: readonly DocumentUi[]
): DocumentUiRegistry => {
  composeDocuments(views.map((view) => view.definition));
  return Object.fromEntries(views.map((view) => [view.definition.kind, view]));
};
