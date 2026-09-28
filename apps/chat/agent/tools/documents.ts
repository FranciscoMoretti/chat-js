import { defineDynamic, defineTool } from "eve/tools";

import { config } from "../../lib/config";
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentOperations,
  eveDocumentReadInput,
  eveDocumentReadResult,
  eveDocumentWriteResult,
} from "../../lib/eve/document-contracts";
import { executeEveCodeDocument } from "../../lib/eve/document-execution";
import { documentExecutionInput } from "../../lib/eve/document-execution-contracts";
import { executeEveDocumentTool } from "../../lib/eve/document-tools";
import { toolResultToModelOutput } from "../../lib/eve/tool-model-output";
import { filterEveTools } from "../../lib/eve/turn-tools";
import { codeGuidelines } from "../../tools/platform/documents/code-guidelines";
import { sheetGuidelines } from "../../tools/platform/documents/sheet-guidelines";
import { textGuidelines } from "../../tools/platform/documents/text-guidelines";

const guidelines = {
  code: codeGuidelines,
  sheet: sheetGuidelines,
  text: textGuidelines,
};

const createDocumentTool = (
  name: Extract<keyof typeof eveDocumentOperations, `create${string}`>
) =>
  defineTool({
    description: `Create a new ${eveDocumentOperations[name].kind} document in this conversation. Supply the complete content and a descriptive title. ${guidelines[eveDocumentOperations[name].kind]}`,
    execute: async (input, context) =>
      eveDocumentWriteResult.parse(
        await executeEveDocumentTool(name, input, context)
      ),
    inputSchema: eveDocumentCreateInput,
    outputSchema: eveDocumentWriteResult,
  });

const editDocumentTool = (
  name: Extract<keyof typeof eveDocumentOperations, `edit${string}`>
) =>
  defineTool({
    description: `Edit an existing ${eveDocumentOperations[name].kind} document in this conversation. Read the document first and supply its revision ID. Supply the complete replacement content. ${guidelines[eveDocumentOperations[name].kind]}`,
    execute: async (input, context) =>
      eveDocumentWriteResult.parse(
        await executeEveDocumentTool(name, input, context)
      ),
    inputSchema: eveDocumentEditInput,
    outputSchema: eveDocumentWriteResult,
  });

export const documentTools = {
  createCodeDocument: createDocumentTool("createCodeDocument"),
  createSheetDocument: createDocumentTool("createSheetDocument"),
  createTextDocument: createDocumentTool("createTextDocument"),
  editCodeDocument: editDocumentTool("editCodeDocument"),
  editSheetDocument: editDocumentTool("editSheetDocument"),
  editTextDocument: editDocumentTool("editTextDocument"),
  readDocument: defineTool({
    description:
      "Read the latest document content and revision ID in this conversation before editing it.",
    execute: async (input, context) =>
      eveDocumentReadResult.parse(
        await executeEveDocumentTool("readDocument", input, context)
      ),
    inputSchema: eveDocumentReadInput,
    outputSchema: eveDocumentReadResult,
  }),
  runCodeDocument: defineTool({
    description:
      "Run the exact saved Python or JavaScript code document revision in this conversation. Supply its document and revision IDs. Do not copy, rewrite, or substitute its source code.",
    execute: (input, context) => executeEveCodeDocument(input, context),
    inputSchema: documentExecutionInput,
    toModelOutput: toolResultToModelOutput,
  }),
};

export default defineDynamic({
  events: {
    "step.started": () => {
      const tools = filterEveTools(documentTools);
      const { enabled } = config.ai.tools.documents;
      const { types } = config.ai.tools.documents;
      if (!enabled || !types.code) {
        delete tools.createCodeDocument;
        delete tools.editCodeDocument;
      }
      if (!enabled || !types.sheet) {
        delete tools.createSheetDocument;
        delete tools.editSheetDocument;
      }
      if (!enabled || !types.text) {
        delete tools.createTextDocument;
        delete tools.editTextDocument;
      }
      if (!enabled || !(types.code || types.sheet || types.text)) {
        delete tools.readDocument;
      }
      if (!enabled || !types.code || !config.ai.tools.codeExecution.enabled) {
        delete tools.runCodeDocument;
      }
      return tools;
    },
  },
});
