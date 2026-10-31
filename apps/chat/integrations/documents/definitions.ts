import { installedDocuments } from "@/chatjs/generated/documents";
import { composeDocuments } from "@/chatjs/core/documents/document-definition";

export const documentDefinitions = composeDocuments(installedDocuments);
