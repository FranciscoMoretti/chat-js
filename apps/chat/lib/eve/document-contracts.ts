import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { isFileStorageKey } from "@/lib/file-url";
/* oxlint-enable sort-imports */

interface DocumentAssistantRequest {
  message: string;
  modelId: string;
}

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- moving it below executable initialization can obscure ordering and API ownership.
no-magic-numbers (#517): documentFileIds uses 256 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): documentFileIds accepts ids; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const documentFileIds = z
  .array(z.string().refine(isFileStorageKey))
  .max(256)
  .transform((ids) => [...new Set(ids)].toSorted())
  .describe(
    "Stable file IDs used by this document, including embedded images. Provide the complete list on every save, or [] for no attachments; never include presigned URLs."
  );
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): documentContent uses 2_000_000, 1, 1000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const documentContent = z.object({
  content: z.string().max(2_000_000),
  fileIds: documentFileIds,
  title: z.string().min(1).max(1000),
});
/* oxlint-enable no-magic-numbers */

const eveDocumentCreateInput = documentContent;

const eveDocumentEditInput = documentContent.extend({
  documentId: z.uuid(),
  expectedRevisionId: z
    .uuid()
    .describe(
      "The revision ID returned by readDocument. Read again after a conflict."
    ),
});

const eveDocumentReadInput = z.object({ documentId: z.uuid() });

const eveManualDocumentInput = eveDocumentEditInput.extend({
  conversationId: z.uuid(),
  // Manual editors preserve the previous revision's IDs in saveManualEveDocument.
  fileIds: documentFileIds.default([]),
  operationId: z.uuid(),
});

const eveDocumentOperations = {
  createCodeDocument: { edit: false, kind: "code" },
  createSheetDocument: { edit: false, kind: "sheet" },
  createTextDocument: { edit: false, kind: "text" },
  editCodeDocument: { edit: true, kind: "code" },
  editSheetDocument: { edit: true, kind: "sheet" },
  editTextDocument: { edit: true, kind: "text" },
} as const;

const eveDocumentResult = z.object({
  date: z.string(),
  documentId: z.uuid(),
  kind: z.enum(["text", "code", "sheet"]),
  revisionId: z.uuid(),
  status: z.literal("success"),
  title: z.string(),
});

const eveDocumentWriteResult = eveDocumentResult.extend({
  result: z.string(),
});

const eveDocumentReadResult = eveDocumentResult.extend({
  content: z.string(),
  fileIds: z.array(z.string()),
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (documentFileIds, eveDocumentCreateInput, eveDocumentEditInput, eveDocumentOperations, eveDocumentReadInput, eveDocumentReadResult, eveDocumentResult, eveDocumentWriteResult, eveManualDocumentInput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  documentFileIds,
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentOperations,
  eveDocumentReadInput,
  eveDocumentReadResult,
  eveDocumentResult,
  eveDocumentWriteResult,
  eveManualDocumentInput,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (DocumentAssistantRequest); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { DocumentAssistantRequest };
/* oxlint-enable import/no-named-export */
