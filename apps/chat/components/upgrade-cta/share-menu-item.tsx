"use client";

import { Share } from "lucide-react";
import React from "react";
import type { ReactNode } from "react";

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
/* oxlint-disable id-length, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ShareMenuItem: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { onShare, children }: ShareMenuItemProps). */

export const ShareMenuItem = ({ onShare, children }: ShareMenuItemProps) => {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  if (!isAuthenticated) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <DropdownMenuItem
            className="cursor-pointer opacity-50"
            onSelect={(e) => e.preventDefault()}
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
/* oxlint-enable id-length, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
