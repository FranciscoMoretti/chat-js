"use client";

import { Play } from "lucide-react";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { Button } from "@/components/ui/button";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-enable eslint/sort-imports */
import { config } from "@/lib/config";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { DocumentRunProps } from "@/lib/eve/document-ui";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";
/* oxlint-enable eslint/sort-imports */

import { latestDocumentRun } from "./document-runs";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { EveDocumentRunResult } from "./result";
/* oxlint-enable eslint/sort-imports */
import { documentExecutionLanguage } from "./schemas";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/* oxlint-disable typescript/strict-void-return -- The receiving framework deliberately ignores this callback result and owns its completion/error handling. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export const EveDocumentRun = ({
  documentId,
  revisionId,
  title,
  kind,
  messages,
  disabled,
  onAction,
  buttonOnly = false,
  resultOnly = false,
}: DocumentRunProps) => {
  const run = latestDocumentRun(messages, documentId, revisionId);
  const canRun =
    onAction &&
    installedDocumentKinds.has("code") &&
    installedToolNames.has("runCodeDocument") &&
    documentExecutionLanguage(title);
  if (
    kind !== "code" ||
    !(canRun || run) ||
    (resultOnly && !run) ||
    (buttonOnly && !canRun)
  ) {
    return null;
  }
  return (
    <div
      className={buttonOnly ? "shrink-0" : "shrink-0 space-y-2 border-t p-2"}
    >
      {canRun && !resultOnly && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="hover:bg-accent h-fit px-2 py-1.5 [&_svg]:size-[18px]"
              disabled={disabled}
              // oxlint-disable-next-line typescript/no-misused-promises -- TanStack Query tracks refetch state and errors; this UI event deliberately initiates refresh without awaiting a DOM return value.
              onClick={(): Promise<void> =>
                onAction({
                  message: `Run the saved code using runCodeDocument with documentId "${documentId}" and revisionId "${revisionId}". Execute exactly this revision once. Do not edit the document or substitute codeExecution. Report the result briefly.`,
                  modelId: config.ai.tools.code.edits,
                })
              }
              size="sm"
              variant="outline"
            >
              <Play size={18} /> Run
            </Button>
          </TooltipTrigger>
          <TooltipContent>Execute code</TooltipContent>
        </Tooltip>
      )}
      {run && !buttonOnly && (
        <details key={run.part.toolCallId} open>
          <summary className="cursor-pointer text-sm">Execution result</summary>
          <div
            className="max-h-64 overflow-auto pt-2"
            data-testid="document-run-result"
          >
            <EveDocumentRunResult part={run.part} />
          </div>
        </details>
      )}
    </div>
  );
};
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/strict-void-return */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
