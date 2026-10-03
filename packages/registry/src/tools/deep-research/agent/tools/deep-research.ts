import { defineWorkflowTool } from "eve/tools";

import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { researchInput } from "@/tools/chatjs/deep-research/schemas";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { executeEveResearch } from "@/tools/chatjs/deep-research/workflow";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
export default defineWorkflowTool({
  availableInSubagents: false,
  description:
    "Conduct deep research using this conversation and installed search, then save a cited report. Use only for explicit deep research requests, at most once per user turn. If research fails, report the failure and let the user choose whether to retry; do not start duplicate research calls. If clarification is needed, ask the returned questions and call again after the user answers. The report is displayed to the user; do not repeat it in full.",
  execute: executeEveResearch,
  inputSchema: researchInput,
  toModelOutput: toolResultToModelOutput,
});
/* oxlint-enable import/no-default-export */
