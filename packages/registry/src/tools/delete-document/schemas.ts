import { z } from "zod";

const MINIMUM_DOCUMENT_TITLE_LENGTH = 1;
const MAXIMUM_DOCUMENT_TITLE_LENGTH = 1000;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (deleteDocumentInput); the enabled import/no-default-export convention rejects the default-export alternative. */
export const deleteDocumentInput = z.object({
  documentId: z.uuid(),
  expectedRevisionId: z
    .uuid()
    .describe("Current revision ID returned by readDocument."),
  title: z
    .string()
    .min(MINIMUM_DOCUMENT_TITLE_LENGTH)
    .max(MAXIMUM_DOCUMENT_TITLE_LENGTH)
    .describe(
      "Exact current title returned by readDocument, shown for approval."
    ),
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
