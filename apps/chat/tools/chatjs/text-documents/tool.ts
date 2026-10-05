import { defineTool } from "eve/tools";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentWriteResult,
} from "@/lib/eve/document-contracts";
/* oxlint-enable sort-imports */
import { executeEveDocumentTool } from "@/lib/eve/document-tools";

import { textGuidelines } from "./guidelines";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const createTextDocument = defineTool({
  description: `Create a new text document in this conversation. Supply the complete content and a descriptive title. ${textGuidelines}`,
  execute: async (input, context) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("createTextDocument", input, context)
    ),
  inputSchema: eveDocumentCreateInput,
  outputSchema: eveDocumentWriteResult,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const editTextDocument = defineTool({
  description: `Edit an existing text document in this conversation. Read the document first and supply its revision ID. Supply the complete replacement content. ${textGuidelines}`,
  execute: async (input, context) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("editTextDocument", input, context)
    ),
  inputSchema: eveDocumentEditInput,
  outputSchema: eveDocumentWriteResult,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { createTextDocument, editTextDocument };
