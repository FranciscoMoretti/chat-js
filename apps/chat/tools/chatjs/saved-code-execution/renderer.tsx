"use client";
import React from "react";

import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { documentExecutionInput, eveCodeExecutionResult } from "./schemas";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (SavedCodeRenderer); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/jsx-no-literals -- SavedCodeRenderer renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const SavedCodeRenderer = defineToolRenderer({
  inputSchema: documentExecutionInput,
  outputSchema: eveCodeExecutionResult.extend(documentExecutionInput.shape),
  render: ({ tool }) =>
    tool.state === "output-available" ? (
      <div className="space-y-3">
        <p>{tool.output.message}</p>
        <CodeExecutionChart value={tool.output.chart} />
      </div>
    ) : (
      <output>Running saved code…</output>
    ),
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
