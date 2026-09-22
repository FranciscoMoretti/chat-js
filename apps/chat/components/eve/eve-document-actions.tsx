"use client";

import { Copy, History, Redo2, Undo2 } from "lucide-react";
import { parse, unparse } from "papaparse";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  kind: "text" | "code" | "sheet";
  content: string;
  canCompare: boolean;
  comparing: boolean;
  onCompare: () => void;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled: boolean;
  nextDisabled: boolean;
  disabled: boolean;
  run: ReactNode;
}) => {
  const copy = async () => {
    try {
      let copied = content;
      if (kind === "sheet") {
        const parsed = parse<string[]>(content, { skipEmptyLines: true });
        copied = unparse(
          parsed.data.filter((row) => row.some((cell) => cell.trim() !== ""))
        );
      }
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
            onClick={copy}
          >
            <Copy size={kind === "sheet" ? 16 : 18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copyLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
};
