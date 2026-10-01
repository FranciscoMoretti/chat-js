"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { composerControls } from "@/composer-controls";
import { useIsMobile } from "@/hooks/use-mobile";

import type { ComposerControlProps } from "./control";
import { getToolDisplay } from "./tool-display";

export const ComposerMenu = (props: ComposerControlProps) => {
  const mobile = useIsMobile();
  const controls = composerControls.filter(
    ({ Component }) => Component.isAvailable?.(mobile) ?? true
  );
  if (controls.length === 0 && !props.selectedTool) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Composer options"
          className="h-8 gap-2 px-2 @[500px]:h-10"
          disabled={props.disabled}
          size="sm"
          variant="ghost"
        >
          <Plus className="size-4" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          {controls.map(({ id, Component }) => (
            <Component key={id} {...props} />
          ))}
          {props.selectedTool && (
            <>
              {controls.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={props.disabled}
                onSelect={() => props.onToolChange(null)}
              >
                Clear{" "}
                {getToolDisplay(props.selectedTool)?.shortName ??
                  "unavailable tool"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
