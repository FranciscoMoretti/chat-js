"use client";
import type { EveMessagePart } from "eve/client";

import { eveCodeExecutionResult } from "@/lib/eve/document-execution-contracts";
import { toolOutputSchema } from "@/lib/eve/tool-result";

import { CodeExecutionChart } from "../code-execution-chart";

export const EveDocumentRunResult = ({
  part,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
}) => {
  if (part.state === "output-error") {
    return <p role="alert">{part.errorText}</p>;
  }
  if (part.state === "output-denied") {
    return <p>Document execution declined.</p>;
  }
  if (part.state !== "output-available") {
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
  return output.success ? (
    <div className="space-y-3">
      <p>{output.data.message}</p>
      <CodeExecutionChart value={output.data.chart} />
    </div>
  ) : (
    <p role="alert">This saved-code result could not be displayed.</p>
  );
};
