"use client";
import { codeExecutionInput, codeExecutionResult } from "./schemas";
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";
import React from "react";
import { SandboxComposed } from "@/components/sandbox";
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

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
const CodeExecutionView = ({
  tool,
}: Readonly<{ tool: CodeExecutionViewTool }>): React.JSX.Element => {
  const args = tool.input ?? {
    code: "",
    icon: "default",
    language: "python",
    title: "",
  };
  // oxlint-disable-next-line no-ternary -- Keep result as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const result = tool.state === "output-available" ? tool.output : null;
  // oxlint-disable-next-line no-ternary -- Keep code as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const code = typeof args.code === "string" ? args.code : "";
  // oxlint-disable-next-line no-ternary -- Keep title as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const title = typeof args.title === "string" ? args.title : "";
  // oxlint-disable-next-line no-ternary -- Keep language as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const language = args.language === "javascript" ? "javascript" : "python";
  return (
    <div className="space-y-6">
      <SandboxComposed
        code={code}
        language={language}
        output={
          /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading message from result; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. */
          result?.message
          /* oxlint-enable oxc/no-optional-chaining */
        }
        state={tool.state}
        title={title}
      />

      <CodeExecutionChart
        value={
          /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading chart from result; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. */
          result?.chart
          /* oxlint-enable oxc/no-optional-chaining */
        }
      />
    </div>
  );
};
/* oxlint-enable unicorn/no-null */

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
const CodeExecution = defineToolRenderer({
  inputSchema: codeExecutionInput,
  outputSchema: codeExecutionResult,
  render: CodeExecutionView,
  streamingInputSchema: codeExecutionInput.partial().extend({
    // oxlint-disable-next-line promise/prefer-await-to-then, unicorn/prefer-top-level-await -- #574: Zod schema fallback, not a Promise.
    language: codeExecutionInput.shape.language.optional().catch(undefined),
    // oxlint-disable-next-line promise/prefer-await-to-then, unicorn/prefer-top-level-await -- #574: Zod schema fallback, not a Promise.
    title: codeExecutionInput.shape.title.optional().catch(undefined),
  }),
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (CodeExecution); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable eslint/no-undefined */
export { CodeExecution };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (CodeExecutionTool); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { CodeExecutionTool };
/* oxlint-enable import/no-named-export */
