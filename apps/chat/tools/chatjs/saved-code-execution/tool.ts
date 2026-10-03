import { defineTool } from "eve/tools";

import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { executeEveCodeDocument } from "./execute";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { documentExecutionInput } from "./schemas";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const runCodeDocument = defineTool({
  description:
    "Run the exact saved Python or JavaScript code document revision in this conversation. Supply its document and revision IDs. Do not copy, rewrite, or substitute its source code.",
  execute: executeEveCodeDocument,
  inputSchema: documentExecutionInput,
  toModelOutput: toolResultToModelOutput,
});
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
