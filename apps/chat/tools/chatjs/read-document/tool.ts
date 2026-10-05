import { defineTool } from "eve/tools";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveDocumentReadInput,
  eveDocumentReadResult,
} from "@/lib/eve/document-contracts";
/* oxlint-enable sort-imports */
import { executeEveDocumentTool } from "@/lib/eve/document-tools";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const readDocument = defineTool({
  description:
    "Read the latest document content and revision ID in this conversation before editing it.",
  execute: async (input, context) =>
    eveDocumentReadResult.parse(
      await executeEveDocumentTool("readDocument", input, context)
    ),
  inputSchema: eveDocumentReadInput,
  outputSchema: eveDocumentReadResult,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
