import { documentUi } from "@/chatjs/generated/document-ui";
import { composeDocumentViews } from "@/lib/eve/compose-document-views";

export const documents = composeDocumentViews(documentUi);
