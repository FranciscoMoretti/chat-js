"use client";

import { Copy, History, Redo2, Undo2 } from "lucide-react";
import React from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
import { Toggle } from "@/components/ui/toggle";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-enable sort-imports */
import { documentUi } from "@/tools/chatjs/document-ui";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveDocumentActions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- EveDocumentActions renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- EveDocumentActions: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 16); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types */

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
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve copy's awaited sequencing and rejected-Promise behavior. */
  const copy = async (): Promise<void> => {
    try {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling documentUi[kind].copyContent; read copyContent from documentUi[kind]; preserve one receiver evaluation, skipped call arguments and the existing content fallback. The app guidance prefers optional chaining.
      const copied = documentUi[kind]?.copyContent?.(content) ?? content;
      await navigator.clipboard.writeText(copied);
      toast.success(
        // oxlint-disable-next-line no-ternary -- Keep toast.success argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        kind === "sheet" ? "Copied csv to clipboard!" : "Copied to clipboard!"
      );
    } catch {
      toast.error(
        "Could not copy. Check your browser's clipboard permissions."
      );
    }
  };
  /* oxlint-enable oxc/no-async-await */
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
                // oxlint-disable-next-line react/forbid-component-props -- Toggle accepts className in its styling contract; preserve this caller's layout and appearance.
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
            // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
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
            // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
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
            // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
            className={
              // oxlint-disable-next-line no-ternary -- Keep className JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              kind === "sheet" ? "hover:bg-accent h-fit p-2" : buttonClass
            }
            variant="outline"
            disabled={disabled}

            onClick={(): void => {
              void copy();
            }}
          >
            <Copy
              size={
                // oxlint-disable-next-line no-ternary -- Keep size JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                kind === "sheet" ? 16 : 18
              }
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copyLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
