"use client";

import { SandboxComposed } from "@/components/sandbox";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";

import { codeExecutionInput, codeExecutionResult } from "./schemas";

export type CodeExecutionTool = ToolRendererProps<
  typeof codeExecutionInput,
  typeof codeExecutionResult
>["tool"];

const CodeExecutionView = ({ tool }: { tool: CodeExecutionTool }) => {
  const args = tool.input ?? {
    code: "",
    icon: "default",
    language: "python",
    title: "",
  };
  const result = tool.state === "output-available" ? tool.output : null;
  const code = typeof args.code === "string" ? args.code : "";
  const title = typeof args.title === "string" ? args.title : "";
  const language = args.language === "javascript" ? "javascript" : "python";
  return (
    <div className="space-y-6">
      <SandboxComposed
        code={code}
        language={language}
        output={result?.message}
        state={tool.state}
        title={title}
      />

      <CodeExecutionChart value={result?.chart} />
    </div>
  );
};

export const CodeExecution = defineToolRenderer({
  inputSchema: codeExecutionInput,
  outputSchema: codeExecutionResult,
  render: CodeExecutionView,
  streamingInputSchema: codeExecutionInput.partial().extend({
    // oxlint-disable-next-line promise/prefer-await-to-then -- Zod schema fallback, not a Promise.
    language: codeExecutionInput.shape.language.optional().catch(undefined),
    // oxlint-disable-next-line promise/prefer-await-to-then -- Zod schema fallback, not a Promise.
    title: codeExecutionInput.shape.title.optional().catch(undefined),
  }),
});
