import { defineWorkflowTool } from "eve/tools";

import { researchInput } from "../../lib/eve/research-contracts";
import { executeEveResearch } from "../../lib/eve/research-tool";
import { toolResultToModelOutput } from "../../lib/eve/tool-model-output";

export default defineWorkflowTool({
  availableInSubagents: false,
  description:
    "Conduct deep research using this conversation and installed search, then save a cited report. Use only for explicit deep research requests. If clarification is needed, ask the returned questions and call again after the user answers. The report is displayed to the user; do not repeat it in full.",
  execute: executeEveResearch,
  inputSchema: researchInput,
  toModelOutput: toolResultToModelOutput,
});
