import { z } from "zod";

import { isFileStorageKey } from "../file-url";

export const documentFileIds = z
  .array(z.string().refine(isFileStorageKey))
  .max(256)
  .default([])
  .transform((ids) => [...new Set(ids)].toSorted())
  .describe(
    "Stable file IDs used by this document, including embedded images. Include every referenced file ID; never include presigned URLs."
  );

const documentContent = z.object({
  content: z.string().max(2_000_000),
  fileIds: documentFileIds,
  title: z.string().min(1).max(1000),
});
export const eveDocumentCreateInput = documentContent;
export const eveDocumentEditInput = documentContent.extend({
  documentId: z.uuid(),
  expectedRevisionId: z
    .uuid()
    .describe(
      "The revision ID returned by readDocument. Read again after a conflict."
    ),
});
export const eveDocumentReadInput = z.object({ documentId: z.uuid() });
export const eveManualDocumentInput = eveDocumentEditInput.extend({
  conversationId: z.uuid(),
  operationId: z.uuid(),
});

export const eveDocumentOperations = {
  createCodeDocument: { edit: false, kind: "code" },
  createSheetDocument: { edit: false, kind: "sheet" },
  createTextDocument: { edit: false, kind: "text" },
  editCodeDocument: { edit: true, kind: "code" },
  editSheetDocument: { edit: true, kind: "sheet" },
  editTextDocument: { edit: true, kind: "text" },
} as const;

export const eveDocumentResult = z.object({
  date: z.string(),
  documentId: z.uuid(),
  kind: z.enum(["text", "code", "sheet"]),
  revisionId: z.uuid(),
  status: z.literal("success"),
  title: z.string(),
});
