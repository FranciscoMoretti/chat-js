import { defineTool } from "eve/tools";
import { documentExecutionInput } from "./schemas";
import { executeEveCodeDocument } from "./execute";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (runCodeDocument); the enabled import/no-default-export convention rejects the default-export alternative. */

export const runCodeDocument = defineTool({
  description:
    "Run the exact saved Python or JavaScript code document revision in this conversation. Supply its document and revision IDs. Do not copy, rewrite, or substitute its source code.",
  execute: executeEveCodeDocument,
  inputSchema: documentExecutionInput,
  toModelOutput: toolResultToModelOutput,
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
