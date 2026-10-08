/* oxlint-disable oxc/no-async-await -- Native async Actions and operations preserve awaited sequencing and route rejections to their declared owner. */
"use client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";
import { Button } from "@/components/ui/button";
import type { DocumentRunProps } from "@/lib/eve/document-ui";
import { EveDocumentRunResult } from "./result";
import { Play } from "lucide-react";
import React from "react";
import { config } from "@/lib/config";
import { documentExecutionLanguage } from "./schemas";
import { latestDocumentRun } from "./document-runs";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveDocumentRun); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/jsx-no-literals -- EveDocumentRun renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
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
}: DocumentRunProps): React.JSX.Element | null => {
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-enable oxc/no-async-await */
