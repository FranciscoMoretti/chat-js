"use client";

import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";

import { documentExecutionInput, eveCodeExecutionResult } from "./schemas";

export const SavedCodeRenderer = defineToolRenderer({
  inputSchema: documentExecutionInput,
  outputSchema: eveCodeExecutionResult.extend(documentExecutionInput.shape),
  render: ({ tool }) =>
    tool.state === "output-available" ? (
      <div className="space-y-3">
        <p>{tool.output.message}</p>
        <CodeExecutionChart value={tool.output.chart} />
      </div>
    ) : (
      <output>Running saved code…</output>
    ),
});
