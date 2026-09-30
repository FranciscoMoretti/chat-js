import { defineTool } from "eve/tools";

import {
  eveDocumentReadInput,
  eveDocumentReadResult,
} from "@/lib/eve/document-contracts";
import { executeEveDocumentTool } from "@/lib/eve/document-tools";

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
