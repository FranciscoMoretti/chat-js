import { z } from "zod";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
