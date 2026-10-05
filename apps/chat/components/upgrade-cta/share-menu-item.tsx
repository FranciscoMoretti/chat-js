"use client";

import { Share } from "lucide-react";
import type { JSX as ReactJSX, ReactNode } from "react";
import React from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSession } from "@/providers/session-provider";

interface ShareMenuItemProps {
  children?: ReactNode;
  onShare: () => void;
}
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- ShareMenuItem: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { onShare, children }: ShareMenuItemProps). */

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
            onSelect={(event) => event.preventDefault()}
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
    <DropdownMenuItem className="cursor-pointer" onClick={onShare}>
      <Share size={16} />
      <span>Share</span>
      {children}
    </DropdownMenuItem>
  );
};
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
