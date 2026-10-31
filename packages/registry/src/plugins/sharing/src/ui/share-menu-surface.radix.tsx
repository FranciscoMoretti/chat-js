"use client";

import React from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { JSX as ReactJSX } from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { Share } from "lucide-react";

interface ShareMenuSurfaceProps {
  readonly authenticated: boolean;
  readonly children?: ReadonlyReactNode;
  readonly onShare: () => void;
}

export const ShareMenuSurface = ({
  authenticated,
  onShare,
  children,
}: ShareMenuSurfaceProps): ReactJSX.Element => {
  if (!authenticated) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <DropdownMenuItem
            className="cursor-pointer opacity-50"
            onSelect={(event: Event) => {
              event.preventDefault();
            }}
          >
            <Share size={16} />
            <span>Share</span>
          </DropdownMenuItem>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <p className="text-sm">Sign in to share your chats</p>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      onSelect={(event: Event) => {
        event.preventDefault();
        onShare();
      }}
    >
      <Share size={16} />
      <span>Share</span>
      {children}
    </DropdownMenuItem>
  );
};
