import { defineTool } from "eve/tools";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentWriteResult,
} from "@/lib/eve/document-contracts";
/* oxlint-enable sort-imports */
import { executeEveDocumentTool } from "@/lib/eve/document-tools";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { codeGuidelines } from "./guidelines";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const createCodeDocument = defineTool({
  description: `Create a new code document in this conversation. Supply the complete content and a descriptive title. ${codeGuidelines}`,
  execute: async (input, context) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("createCodeDocument", input, context)
    ),
  inputSchema: eveDocumentCreateInput,
  outputSchema: eveDocumentWriteResult,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const editCodeDocument = defineTool({
  description: `Edit an existing code document in this conversation. Read the document first and supply its revision ID. Supply the complete replacement content. ${codeGuidelines}`,
  execute: async (input, context) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("editCodeDocument", input, context)
    ),
  inputSchema: eveDocumentEditInput,
  outputSchema: eveDocumentWriteResult,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { createCodeDocument, editCodeDocument };
