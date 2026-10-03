"use client";

import { Copy, History, Redo2, Undo2 } from "lucide-react";
import React from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { documentUi } from "@/tools/chatjs/document-ui";
/* oxlint-disable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/prefer-readonly-parameter-types -- EveDocumentActions: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 16); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types */

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
/* oxlint-enable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/prefer-readonly-parameter-types */
