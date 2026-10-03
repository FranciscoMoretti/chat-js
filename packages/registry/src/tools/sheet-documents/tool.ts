import { defineTool } from "eve/tools";

import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentWriteResult,
} from "@/lib/eve/document-contracts";
import { executeEveDocumentTool } from "@/lib/eve/document-tools";

import { sheetGuidelines } from "./guidelines";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const createSheetDocument = defineTool({
  description: `Create a new sheet document in this conversation. Supply the complete content and a descriptive title. ${sheetGuidelines}`,
  execute: async (input, context) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("createSheetDocument", input, context)
    ),
  inputSchema: eveDocumentCreateInput,
  outputSchema: eveDocumentWriteResult,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const editSheetDocument = defineTool({
  description: `Edit an existing sheet document in this conversation. Read the document first and supply its revision ID. Supply the complete replacement content. ${sheetGuidelines}`,
  execute: async (input, context) =>
    eveDocumentWriteResult.parse(
      await executeEveDocumentTool("editSheetDocument", input, context)
    ),
  inputSchema: eveDocumentEditInput,
  outputSchema: eveDocumentWriteResult,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */
