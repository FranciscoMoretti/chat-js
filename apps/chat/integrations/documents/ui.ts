import { documentUi } from "@/chatjs/generated/document-ui";
import { composeDocumentViews } from "@/chatjs/core/documents/compose-views";

export const documents = composeDocumentViews(documentUi);
