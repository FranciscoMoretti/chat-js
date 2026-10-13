"use client";
import { documentExecutionInput, eveCodeExecutionResult } from "./schemas";
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { z as Zod } from "zod";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";

type SavedCodeInput = Zod.output<typeof documentExecutionInput>;
type SavedCodeOutput = Zod.output<typeof eveCodeExecutionResult> &
  SavedCodeInput;
type SavedCodeTool = { toolCallId: string } & (
  | {
      state: "input-streaming";
      input?: Partial<SavedCodeInput>;
      output?: never;
    }
  | { state: "input-available"; input: SavedCodeInput; output?: never }
  | {
      state: "output-available";
      input: SavedCodeInput;
      output: SavedCodeOutput;
    }
);
type SavedCodeRenderProps = ReadonlyNativeSurface<{
  isReadonly: boolean;
  messageId: string;
  tool: SavedCodeTool;
}>;

export const SavedCodeRenderer = defineToolRenderer({
  inputSchema: documentExecutionInput,
  outputSchema: eveCodeExecutionResult.extend(documentExecutionInput.shape),
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
