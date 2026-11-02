"use client";
import { documentExecutionInput, documentExecutionResult } from "./schemas";
import { CodeExecutionChart } from "@/chatjs/tools/_shared/code-execution/code-execution-chart";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolRendererProps } from "@/chatjs/core/tools/define-renderer";
import { defineToolRenderer } from "@/chatjs/core/tools/define-renderer";

type SavedCodeRenderProps = ReadonlyNativeSurface<
  ToolRendererProps<
    typeof documentExecutionInput,
    typeof documentExecutionResult
  >
>;

export const SavedCodeRenderer = defineToolRenderer({
  inputSchema: documentExecutionInput,
  outputSchema: documentExecutionResult,
  render: ({ tool }: SavedCodeRenderProps) => {
    if (tool.state === "output-available") {
      return (
        <div className="space-y-3">
          <p>{tool.output.message}</p>
          <CodeExecutionChart value={tool.output.chart} />
        </div>
      );
    }
    return <output>Running saved code…</output>;
  },
});
