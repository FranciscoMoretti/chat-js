import { isFileStorageKey } from "@/lib/file-url";
import { z } from "zod";

interface DocumentAssistantRequest {
  readonly message: string;
  readonly modelId: string;
}

const maximumDocumentFileCount = 256;
const maximumDocumentContentLength = 2_000_000;
const minimumDocumentTitleLength = 1;
const maximumDocumentTitleLength = 1000;

const documentFileIds = z
  .array(z.string().refine(isFileStorageKey))
  .max(maximumDocumentFileCount)
  .transform((ids: readonly string[]) => [...new Set(ids)].toSorted())
  .describe(
    "Stable file IDs used by this document, including embedded images. Provide the complete list on every save, or [] for no attachments; never include presigned URLs."
  );

const documentContent = z.object({
  content: z.string().max(maximumDocumentContentLength),
  fileIds: documentFileIds,
  title: z
    .string()
    .min(minimumDocumentTitleLength)
    .max(maximumDocumentTitleLength),
});

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
