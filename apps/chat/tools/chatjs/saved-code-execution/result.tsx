"use client";
import type { EveMessagePart } from "eve/client";
import React from "react";

import { toolOutputSchema } from "@/lib/eve/tool-result";
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";

import { eveCodeExecutionResult } from "./schemas";

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable eslint/max-statements */
