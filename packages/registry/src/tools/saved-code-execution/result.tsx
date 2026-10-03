"use client";
import type { EveMessagePart } from "eve/client";

import { toolOutputSchema } from "@/lib/eve/tool-result";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { CodeExecutionChart } from "@/tools/chatjs/_shared/code-execution/code-execution-chart";
/* oxlint-enable eslint/sort-imports */

import { eveCodeExecutionResult } from "./schemas";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
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
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
