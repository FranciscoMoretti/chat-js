import { defineTool } from "eve/tools";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentWriteResult,
} from "@/lib/eve/document-contracts";
/* oxlint-enable sort-imports */
import { executeEveDocumentTool } from "@/lib/eve/document-tools";

import { sheetGuidelines } from "./guidelines";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const createSheetDocument = defineTool({
  description: `Create a new sheet document in this conversation. Supply the complete content and a descriptive title. ${sheetGuidelines}`,
  execute: async (input, context) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("createSheetDocument", input, context)
    ),
  inputSchema: eveDocumentCreateInput,
  outputSchema: eveDocumentWriteResult,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const editSheetDocument = defineTool({
  description: `Edit an existing sheet document in this conversation. Read the document first and supply its revision ID. Supply the complete replacement content. ${sheetGuidelines}`,
  execute: async (input, context) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("editSheetDocument", input, context)
    ),
  inputSchema: eveDocumentEditInput,
  outputSchema: eveDocumentWriteResult,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { createSheetDocument, editSheetDocument };
