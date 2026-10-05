"use client";
import type { EveMessagePart } from "eve/client";
import React from "react";

import { toolOutputSchema } from "@/lib/eve/tool-result";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";
/* oxlint-enable sort-imports */

import { eveCodeExecutionResult } from "./schemas";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveDocumentRunResult); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/jsx-no-literals -- EveDocumentRunResult renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */

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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable eslint/max-statements */
