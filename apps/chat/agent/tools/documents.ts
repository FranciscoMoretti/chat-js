import { defineDynamic, defineTool } from "eve/tools";
import { config } from "../../lib/config";
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentOperations,
  eveDocumentReadInput,
} from "../../lib/eve/document-contracts";
import { executeEveDocumentTool } from "../../lib/eve/document-tools";
import { codeGuidelines } from "../../tools/platform/documents/code-guidelines";
import { sheetGuidelines } from "../../tools/platform/documents/sheet-guidelines";
import { textGuidelines } from "../../tools/platform/documents/text-guidelines";

const guidelines = {
  text: textGuidelines,
  code: codeGuidelines,
  sheet: sheetGuidelines,
};

export default defineDynamic({
  events: {
    "step.started": () => {
      const tools: Record<string, ReturnType<typeof defineTool>> = {};
      if (!config.ai.tools.documents.enabled) {
        return tools;
      }
      for (const [name, operation] of Object.entries(eveDocumentOperations)) {
        if (!config.ai.tools.documents.types[operation.kind]) {
          continue;
        }
        tools[name] = defineTool<unknown, unknown>({
          description: `${operation.edit ? "Edit an existing" : "Create a new"} ${operation.kind} document in this conversation. ${operation.edit ? "Read the document first and supply its revision ID. Supply the complete replacement content." : "Supply the complete content and a descriptive title."} ${guidelines[operation.kind]}`,
          inputSchema: operation.edit
            ? eveDocumentEditInput
            : eveDocumentCreateInput,
          execute: (input, context) =>
            executeEveDocumentTool(name, input, context),
        });
      }
      if (Object.keys(tools).length) {
        tools.readDocument = defineTool<unknown, unknown>({
          description:
            "Read the latest document content and revision ID in this conversation before editing it.",
          inputSchema: eveDocumentReadInput,
          execute: (input, context) =>
            executeEveDocumentTool("readDocument", input, context),
        });
      }
      return tools;
    },
  },
});
