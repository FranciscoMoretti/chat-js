"use client";
import React from "react";

import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { documentExecutionInput, eveCodeExecutionResult } from "./schemas";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
