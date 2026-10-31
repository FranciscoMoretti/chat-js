"use client";
import type { EveMessagePart } from "eve/client";
import React from "react";
import { eveCodeExecutionResult } from "./schemas";
import { toolOutputSchema } from "@/lib/eve/tool-result";
import { CodeExecutionChart } from "@/chatjs/tools/_shared/code-execution/code-execution-chart";

export const EveDocumentRunResult = ({
  part,
}: Readonly<{
  part: Extract<EveMessagePart, { type: "tool" }>;
}>): React.JSX.Element => {
  if (part.state === "failed") {
    return <p role="alert">{part.error?.message ?? "Tool failed"}</p>;
  }
  if (part.state === "rejected") {
    return <p>Document execution declined.</p>;
  }
  if (part.state !== "completed") {
    return <output>Running saved code…</output>;
  }
  const result = toolOutputSchema.safeParse(part.output);
  if (!result.success) {
    return <p role="alert">This tool result could not be displayed.</p>;
  }
  if (result.data.status === "error") {
    return <p role="alert">{result.data.error}</p>;
  }
  const output = eveCodeExecutionResult.safeParse(result.data.output);
  if (output.success) {
    return (
      <div className="space-y-3">
        <p>{output.data.message}</p>
        <CodeExecutionChart value={output.data.chart} />
      </div>
    );
  }
  return <p role="alert">This saved-code result could not be displayed.</p>;
};
