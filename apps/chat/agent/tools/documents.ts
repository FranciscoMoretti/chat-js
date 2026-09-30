import { defineDynamic, defineTool } from "eve/tools";

import { executeEveCodeDocument } from "../../lib/eve/document-execution";
import { documentExecutionInput } from "../../lib/eve/document-execution-contracts";
import { toolResultToModelOutput } from "../../lib/eve/tool-model-output";
import { filterEveTools } from "../../lib/eve/turn-tools";

export const documentTools = {
  runCodeDocument: defineTool({
    description:
      "Run the exact saved Python or JavaScript code document revision in this conversation. Supply its document and revision IDs. Do not copy, rewrite, or substitute its source code.",
    execute: (input, context) => executeEveCodeDocument(input, context),
    inputSchema: documentExecutionInput,
    toModelOutput: toolResultToModelOutput,
  }),
};

export default defineDynamic({
  events: { "step.started": () => filterEveTools(documentTools) },
});
