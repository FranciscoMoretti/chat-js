"use client";

import { Hint } from "@/components/hint";
import { Copy, History, Redo2, Undo2 } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { documents } from "@/integrations/documents/ui";

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
  readonly kind: string;
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
  const document = documents[kind];
  const copy = async (): Promise<void> => {
    try {
      const copied = documents[kind]?.copyContent?.(content) ?? content;
      await navigator.clipboard.writeText(copied);
      toast.success(document?.copySuccessMessage ?? "Copied to clipboard!");
    } catch {
      toast.error(
        "Could not copy. Check your browser's clipboard permissions."
      );
    }
  };
  const copyLabel = document?.copyLabel ?? "Copy to clipboard";
  const buttonClass = "hover:bg-accent h-fit p-2 [&_svg]:size-[18px]";
  return (
    <div className="flex shrink-0 flex-row gap-1">
      {run}
      {document?.supportsComparison === true && (
        <Hint
          trigger={
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
          }
        >
          View changes
        </Hint>
      )}
      <Hint
        trigger={
          <Button
            aria-label="View Previous version"
            className={buttonClass}
            variant="outline"
            disabled={disabled || previousDisabled}
            onClick={onPrevious}
          >
            <Undo2 size={18} />
          </Button>
        }
      >
        View Previous version
      </Hint>
      <Hint
        trigger={
          <Button
            aria-label="View Next version"
            className={buttonClass}
            variant="outline"
            disabled={disabled || nextDisabled}
            onClick={onNext}
          >
            <Redo2 size={18} />
          </Button>
        }
      >
        View Next version
      </Hint>
      <Hint
        trigger={
          <Button
            aria-label={copyLabel}
            className={document?.copyButtonClassName ?? buttonClass}
            variant="outline"
            disabled={disabled}

            onClick={(): void => {
              void copy();
            }}
          >
            <Copy size={document?.copyIconSize ?? 18} />
          </Button>
        }
      >
        {copyLabel}
      </Hint>
    </div>
  );
};
