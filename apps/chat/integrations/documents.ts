import { installedDocuments } from "@/chatjs/generated/documents";
import { composeDocuments } from "@/lib/eve/document-definition";

export const documentDefinitions = composeDocuments(installedDocuments);
