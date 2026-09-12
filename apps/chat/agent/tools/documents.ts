import { defineDynamic, defineTool, toolOutput } from "eve/tools";
import { config } from "../../lib/config";
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentOperations,
  eveDocumentReadInput,
} from "../../lib/eve/document-contracts";
import { executeEveCodeDocument } from "../../lib/eve/document-execution";
import { documentExecutionInput } from "../../lib/eve/document-execution-contracts";
import { executeEveDocumentTool } from "../../lib/eve/document-tools";
import { evePlatformResult } from "../../lib/eve/platform-result";
import { filterEveTools } from "../../lib/eve/turn-tools";
import { codeExecutionResult } from "../../tools/platform/code-execution.schemas";
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
        return filterEveTools(tools);
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
      if (
        config.ai.tools.documents.types.code &&
        config.ai.tools.codeExecution.enabled
      ) {
        tools.runCodeDocument = defineTool<unknown, unknown>({
          description:
            "Run the exact saved Python or JavaScript code document revision in this conversation. Supply its document and revision IDs. Do not copy, rewrite, or substitute its source code.",
          inputSchema: documentExecutionInput,
          execute: (input, context) => executeEveCodeDocument(input, context),
          toModelOutput: (output) =>
            toolOutput.json(
              codeExecutionResult.parse(evePlatformResult.parse(output).output)
            ),
        });
      }
      return filterEveTools(tools);
    },
  },
});
