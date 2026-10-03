"use client";
import React from "react";

import { SandboxComposed } from "@/components/sandbox";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";

import { codeExecutionInput, codeExecutionResult } from "./schemas";

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
export type CodeExecutionTool = ToolRendererProps<
  typeof codeExecutionInput,
  typeof codeExecutionResult
>["tool"];
/* oxlint-enable import/exports-last */

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
export const CodeExecution = defineToolRenderer({
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
/* oxlint-enable eslint/no-undefined */
