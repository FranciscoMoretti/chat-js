import { z } from "zod";

export const deleteDocumentInput = z.object({
  documentId: z.uuid(),
  expectedRevisionId: z
    .uuid()
    .describe("Current revision ID returned by readDocument."),
  title: z
    .string()
    .min(1)
    .max(1000)
    .describe(
      "Exact current title returned by readDocument, shown for approval."
    ),
});
