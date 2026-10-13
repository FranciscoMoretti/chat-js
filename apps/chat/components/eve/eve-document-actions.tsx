"use client";

import { Copy, History, Redo2, Undo2 } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { documentUi } from "@/tools/chatjs/document-ui";

export const EveDocumentActions = ({
  kind,
  content,
  canCompare,
  comparing,
  onCompare,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
  disabled,
  run,
}: {
  readonly kind: "text" | "code" | "sheet";
  readonly content: string;
  readonly canCompare: boolean;
  readonly comparing: boolean;
  readonly onCompare: () => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly previousDisabled: boolean;
  readonly nextDisabled: boolean;
  readonly disabled: boolean;
  readonly run: ReadonlyReactNode;
}): React.JSX.Element => {
  const copy = async (): Promise<void> => {
    try {
      const copied = documentUi[kind]?.copyContent?.(content) ?? content;
      await navigator.clipboard.writeText(copied);
      toast.success(
        kind === "sheet" ? "Copied csv to clipboard!" : "Copied to clipboard!"
      );
    } catch {
      toast.error(
        "Could not copy. Check your browser's clipboard permissions."
      );
    }
  };
  let copyLabel = "Copy to clipboard";
  if (kind === "code") {
    copyLabel = "Copy code to clipboard";
  }
  if (kind === "sheet") {
    copyLabel = "Copy as .csv";
  }
  const buttonClass = "hover:bg-accent h-fit p-2 [&_svg]:size-[18px]";
  return (
    <div className="flex shrink-0 flex-row gap-1">
      {run}
      {kind === "text" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Toggle
                aria-label="View changes"
                className="h-fit p-2 [&_svg]:size-[18px]"
                disabled={disabled || !canCompare}
                pressed={comparing}
                onPressedChange={onCompare}
              >
                <History size={18} />
              </Toggle>
            </div>
          </TooltipTrigger>
          <TooltipContent>View changes</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="View Previous version"
            className={buttonClass}
            variant="outline"
            disabled={disabled || previousDisabled}
            onClick={onPrevious}
          >
            <Undo2 size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View Previous version</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="View Next version"
            className={buttonClass}
            variant="outline"
            disabled={disabled || nextDisabled}
            onClick={onNext}
          >
            <Redo2 size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View Next version</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={copyLabel}
            className={
              kind === "sheet" ? "hover:bg-accent h-fit p-2" : buttonClass
            }
            variant="outline"
            disabled={disabled}

            onClick={(): void => {
              void copy();
            }}
          >
            <Copy size={kind === "sheet" ? 16 : 18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copyLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
};
