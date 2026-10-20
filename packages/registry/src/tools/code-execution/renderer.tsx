"use client";
import { codeExecutionInput, codeExecutionResult } from "./schemas";
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";
import React from "react";
// Preserve the exact TSX target: shadcn otherwise confuses it with subagent sandbox.ts files.
import { SandboxComposed } from "@/components/sandbox.tsx";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";

type CodeExecutionTool = ToolRendererProps<
  typeof codeExecutionInput,
  typeof codeExecutionResult
>["tool"];

type CodeExecutionViewTool = Readonly<{
  state: CodeExecutionTool["state"];
  input?: Readonly<{
    code?: string;
    language?: string;
    title?: string;
  }>;
  output?: Readonly<{
    chart: unknown;
    message: string;
  }>;
}>;

const CodeExecutionView = ({
  tool,
}: Readonly<{ tool: CodeExecutionViewTool }>): React.JSX.Element => {
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

const CodeExecution = defineToolRenderer({
  inputSchema: codeExecutionInput,
  outputSchema: codeExecutionResult,
  render: CodeExecutionView,
  streamingInputSchema: codeExecutionInput.partial().extend({
    // oxlint-disable-next-line promise/prefer-await-to-then, unicorn/no-useless-undefined -- oxc-project/oxc#22161: synchronous Zod fallback preserves streamed code on invalid language. Zod requires the undefined fallback argument.
    language: codeExecutionInput.shape.language.optional().catch(undefined),
    // oxlint-disable-next-line promise/prefer-await-to-then, unicorn/no-useless-undefined -- oxc-project/oxc#22161: synchronous Zod fallback preserves streamed code on invalid title. Zod requires the undefined fallback argument.
    title: codeExecutionInput.shape.title.optional().catch(undefined),
  }),
});
export { CodeExecution };
export type { CodeExecutionTool };
