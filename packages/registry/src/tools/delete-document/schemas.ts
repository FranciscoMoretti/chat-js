import { z } from "zod";

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
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
/* oxlint-enable eslint/no-magic-numbers */
