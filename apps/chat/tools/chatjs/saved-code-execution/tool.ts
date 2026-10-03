import { defineTool } from "eve/tools";

import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";

import { executeEveCodeDocument } from "./execute";
import { documentExecutionInput } from "./schemas";

export const runCodeDocument = defineTool({
  description:
    "Run the exact saved Python or JavaScript code document revision in this conversation. Supply its document and revision IDs. Do not copy, rewrite, or substitute its source code.",
  execute: executeEveCodeDocument,
  inputSchema: documentExecutionInput,
  toModelOutput: toolResultToModelOutput,
});
