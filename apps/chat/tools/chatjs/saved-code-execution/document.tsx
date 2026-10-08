/* oxlint-disable oxc/no-async-await -- Native async Actions and operations preserve awaited sequencing and route rejections to their declared owner. */
"use client";
import { Play } from "lucide-react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-enable sort-imports */
import { config } from "@/lib/config";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DocumentRunProps } from "@/lib/eve/document-ui";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";
/* oxlint-enable sort-imports */

import { latestDocumentRun } from "./document-runs";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveDocumentRunResult } from "./result";
/* oxlint-enable sort-imports */
import { documentExecutionLanguage } from "./schemas";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveDocumentRun); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/jsx-no-literals -- EveDocumentRun renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
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
  const [, startEventAction] = React.useTransition();
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
      // oxlint-disable-next-line no-ternary -- Keep className JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      className={buttonOnly ? "shrink-0" : "shrink-0 space-y-2 border-t p-2"}
    >
      {canRun && !resultOnly && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
              className="hover:bg-accent h-fit px-2 py-1.5 [&_svg]:size-[18px]"
              disabled={disabled}

              onClick={() => {
                startEventAction(async () => {
                  await onAction({
                    message: `Run the saved code using runCodeDocument with documentId "${documentId}" and revisionId "${revisionId}". Execute exactly this revision once. Do not edit the document or substitute codeExecution. Report the result briefly.`,
                    modelId: config.ai.tools.code.edits,
                  });
                });
              }}
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/strict-void-return */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */

/* oxlint-enable oxc/no-async-await */
