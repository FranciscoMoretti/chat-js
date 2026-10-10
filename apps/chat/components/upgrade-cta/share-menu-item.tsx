"use client";

import React from "react";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping react and @/components/ui/dropdown-menu; keep this adjacent import pair ordered. */
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/components/ui/dropdown-menu and @/components/ui/popover; keep this adjacent import pair ordered. */
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
/* oxlint-enable sort-imports */

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
}): void => event.preventDefault();
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ShareMenuItem); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- ShareMenuItem renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable react/jsx-max-depth -- ShareMenuItem: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

export const ShareMenuItem = ({
  onShare,
  children,
}: ShareMenuItemProps): ReactJSX.Element => {
  const { data: session } = useSession();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const isAuthenticated = Boolean(session?.user);

  if (!isAuthenticated) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <DropdownMenuItem
            // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuItem accepts className in its styling contract; preserve this caller's layout and appearance.
            className="cursor-pointer opacity-50"
            onSelect={preventEventDefault}
          >
            <Share size={16} />
            <span>Share</span>
          </DropdownMenuItem>
        </PopoverTrigger>
        <PopoverContent
          // oxlint-disable-next-line react/forbid-component-props -- PopoverContent accepts className in its styling contract; preserve this caller's layout and appearance.
          className="w-auto p-2"
        >
          <p className="text-sm">Sign in to share your chats</p>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenuItem
      // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuItem accepts className in its styling contract; preserve this caller's layout and appearance.
      className="cursor-pointer"
      onClick={onShare}
    >
      <Share size={16} />
      <span>Share</span>
      {children}
    </DropdownMenuItem>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-max-depth */
