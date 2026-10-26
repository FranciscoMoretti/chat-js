"use client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/composition/generated/installed-tools";
import { Button } from "@/components/ui/button";
import type { DocumentRunProps } from "@/lib/eve/document-ui";
import { EveDocumentRunResult } from "./result";
import { Play } from "lucide-react";
import React from "react";
import { config } from "@/lib/config";
import { documentExecutionLanguage } from "./schemas";
import { latestDocumentRun } from "./document-runs";

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
    onAction !== undefined &&
    installedDocumentKinds.has("code") &&
    installedToolNames.has("runCodeDocument") &&
    documentExecutionLanguage(title) !== undefined;
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
          <TooltipTrigger
            render={
              <Button
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
            }
          />
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
