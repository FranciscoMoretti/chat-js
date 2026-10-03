/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../file-url" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { z } from "zod";

import { isFileStorageKey } from "../file-url";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/exports-last, typescript/consistent-type-definitions  --
 * import/exports-last (#522): DocumentAssistantRequest is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/no-named-export (#527): Preserve the named DocumentAssistantRequest API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/consistent-type-definitions (#559): DocumentAssistantRequest preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type DocumentAssistantRequest = { message: string; modelId: string };
/* oxlint-enable import/exports-last, typescript/consistent-type-definitions */

/* oxlint-disable import/exports-last, import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * import/exports-last (#522): documentFileIds is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): documentFileIds stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named documentFileIds API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): documentFileIds uses 256 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): documentFileIds accepts ids; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const documentFileIds = z
  .array(z.string().refine(isFileStorageKey))
  .max(256)
  .transform((ids) => [...new Set(ids)].toSorted())
  .describe(
    "Stable file IDs used by this document, including embedded images. Provide the complete list on every save, or [] for no attachments; never include presigned URLs."
  );
/* oxlint-enable import/exports-last, import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): documentContent uses 2_000_000, 1, 1000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const documentContent = z.object({
  content: z.string().max(2_000_000),
  fileIds: documentFileIds,
  title: z.string().min(1).max(1000),
});
/* oxlint-enable no-magic-numbers */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveDocumentCreateInput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentCreateInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveDocumentCreateInput = documentContent;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveDocumentEditInput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentEditInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveDocumentEditInput = documentContent.extend({
  documentId: z.uuid(),
  expectedRevisionId: z
    .uuid()
    .describe(
      "The revision ID returned by readDocument. Read again after a conflict."
    ),
});
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveDocumentReadInput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentReadInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveDocumentReadInput = z.object({ documentId: z.uuid() });
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveManualDocumentInput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveManualDocumentInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveManualDocumentInput = eveDocumentEditInput.extend({
  conversationId: z.uuid(),
  // Manual editors preserve the previous revision's IDs in saveManualEveDocument.
  fileIds: documentFileIds.default([]),
  operationId: z.uuid(),
});
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveDocumentOperations stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentOperations API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveDocumentOperations = {
  createCodeDocument: { edit: false, kind: "code" },
  createSheetDocument: { edit: false, kind: "sheet" },
  createTextDocument: { edit: false, kind: "text" },
  editCodeDocument: { edit: true, kind: "code" },
  editSheetDocument: { edit: true, kind: "sheet" },
  editTextDocument: { edit: true, kind: "text" },
} as const;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveDocumentResult stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentResult API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveDocumentResult = z.object({
  date: z.string(),
  documentId: z.uuid(),
  kind: z.enum(["text", "code", "sheet"]),
  revisionId: z.uuid(),
  status: z.literal("success"),
  title: z.string(),
});
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveDocumentWriteResult stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentWriteResult API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveDocumentWriteResult = eveDocumentResult.extend({
  result: z.string(),
});
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveDocumentReadResult stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveDocumentReadResult API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveDocumentReadResult = eveDocumentResult.extend({
  content: z.string(),
  fileIds: z.array(z.string()),
});
/* oxlint-enable import/group-exports */
