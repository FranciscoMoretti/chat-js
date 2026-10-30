"use client";

import { MenuButton } from "@/components/menu-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { ComposerControlProps } from "./control";

import { Plus } from "lucide-react";

import React from "react";

import type { JSX as ReactJSX } from "react";
import {
  ComposerAttachments,
  ComposerExtensions,
} from "@/components/chat-slots";
import { composerControls } from "@/composer-controls";

import { getToolDisplay } from "./tool-display";

import { useIsMobile } from "@/hooks/use-mobile";

export const ComposerMenu = (
  props: ComposerControlProps
): ReactJSX.Element | null => {
  const mobile = useIsMobile();
  const hasAttachments = ComposerAttachments.useHasContent();
  const hasExtensions = ComposerExtensions.useHasContent();
  const controls = composerControls.filter(
    ({
      Component,
    }: {
      readonly Component: Readonly<
        Pick<(typeof composerControls)[number]["Component"], "isAvailable">
      >;
    }) => Component.isAvailable?.(mobile) ?? true
  );
  const hasControls = controls.length > 0 || hasAttachments || hasExtensions;
  if (!hasControls && !props.selectedTool) {
    return null;
  }
  return (
    <DropdownMenu>
      <MenuButton
        aria-label="Composer options"
        className="h-8 gap-2 px-2 @[500px]:h-10"
        disabled={props.disabled}
        size="sm"
        variant="ghost"
      >
        <Plus className="size-4" />
        Add
      </MenuButton>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <ComposerAttachments {...props} />
          {controls.map(
            ({
              id,
              Component,
            }: Readonly<Pick<(typeof composerControls)[number], "id">> & {
              readonly Component: React.JSXElementConstructor<ComposerControlProps>;
            }): React.JSX.Element => (
              <Component key={id} {...props} />
            )
          )}
          <ComposerExtensions {...props} />
          {props.selectedTool && (
            <>
              {hasControls && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={props.disabled}
                onClick={() => {
                  props.onToolChange(null);
                }}
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
