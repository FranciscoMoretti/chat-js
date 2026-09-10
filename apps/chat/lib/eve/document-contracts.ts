import { z } from "zod";

const documentContent = z.object({
  title: z.string().min(1).max(1000),
  content: z.string().max(2_000_000),
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

export const eveDocumentOperations = {
  createTextDocument: { kind: "text", edit: false },
  editTextDocument: { kind: "text", edit: true },
  createCodeDocument: { kind: "code", edit: false },
  editCodeDocument: { kind: "code", edit: true },
  createSheetDocument: { kind: "sheet", edit: false },
  editSheetDocument: { kind: "sheet", edit: true },
} as const;

export const eveDocumentResult = z.object({
  status: z.literal("success"),
  documentId: z.uuid(),
  revisionId: z.uuid(),
  title: z.string(),
  kind: z.enum(["text", "code", "sheet"]),
  date: z.string(),
});
