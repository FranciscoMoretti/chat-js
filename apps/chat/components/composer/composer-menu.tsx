"use client";

import { Plus } from "lucide-react";

import { toolDefinitions } from "@/components/chat-features-definitions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { composerControls } from "@/composer-controls";

import type { ComposerControlProps } from "./control";

export const ComposerMenu = (props: ComposerControlProps) => (
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
        {props.selectedTool
          ? toolDefinitions[props.selectedTool].shortName
          : "Add"}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-56">
      {composerControls.map(({ id, Component }) => (
        <Component key={id} {...props} />
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
