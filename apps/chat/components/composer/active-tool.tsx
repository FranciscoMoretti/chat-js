"use client";

import { CircleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UiToolName } from "@/lib/ai/types";
import { cn } from "@/lib/utils";
import { composerTools } from "@/tools/chatjs/composer-tools";

export const ActiveTool = ({
  selectedTool,
  disabled,
  onClear,
}: {
  selectedTool: UiToolName | null;
  disabled?: boolean;
  onClear: () => void;
}) => {
  if (!selectedTool) {
    return null;
  }
  const definition = composerTools[selectedTool];
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
