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

import { useSession } from "@/providers/session-provider";

interface ShareMenuItemProps {
  readonly children?: ReadonlyReactNode;
  readonly onShare: () => void;
}

const preventEventDefault = (event: {
  readonly preventDefault: () => void;
}): void => {
  event.preventDefault();
};

export const ShareMenuItem = ({
  onShare,
  children,
}: ShareMenuItemProps): ReactJSX.Element => {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  if (!isAuthenticated) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <DropdownMenuItem
            className="cursor-pointer opacity-50"
            onSelect={preventEventDefault}
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
      onSelect={(event) => {
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
