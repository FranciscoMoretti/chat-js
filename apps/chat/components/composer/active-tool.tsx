"use client";

import { CircleAlert, X } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import type { UiToolName } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

import { getToolDisplay } from "./tool-display";
/* oxlint-disable unicorn/no-null --  unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ActiveTool = ({
  selectedTool,
  disabled,
  onClear,
}: {
  readonly selectedTool: UiToolName | null;
  readonly disabled?: boolean;
  readonly onClear: () => void;
}): React.JSX.Element | null => {
  if (!selectedTool) {
    return null;
  }
  const definition = getToolDisplay(selectedTool);
  const Icon = definition?.icon ?? CircleAlert;
  const label = definition?.shortName ?? "Unavailable tool";
  return (
    <Button
      aria-label={definition ? `Clear ${label} tool` : "Clear unavailable tool"}
      className={cn(
        "h-8 gap-1 rounded-full px-2 @[500px]:h-10 @[500px]:gap-2",
        definition ? "text-primary" : "text-destructive"
      )}
      disabled={disabled}
      onClick={onClear}
      size="sm"
      title={label}
      variant="ghost"
    >
      <Icon className="size-3.5" />
      <span className={cn(definition && "hidden @[500px]:inline")}>
        {label}
      </span>
      <X className="size-3 opacity-70" />
    </Button>
  );
};
/* oxlint-enable unicorn/no-null */
