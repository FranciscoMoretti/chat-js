import { toolOutput } from "eve/tools";

import type { ToolOutput, ToolResult } from "./tool-result";

/** One projection for every metered tool; billing and progress stay out of model context. */
export const toolResultToModelOutput = (result: ToolResult<ToolOutput>) =>
  toolOutput.json(
    result.status === "error" ? { error: result.error } : result.output
  );
