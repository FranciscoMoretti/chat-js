"use client";

import { HeaderActions } from "@/components/header-actions";

import React from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ChatHeaderView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-max-depth -- ChatHeaderView: ; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

export const ChatHeaderView = ({
  breadcrumb,
  actions,
  className,
}: {
  readonly breadcrumb: ReadonlyReactNode;
  readonly actions?: ReadonlyReactNode;
  readonly className?: string;
}): React.JSX.Element => (
  <header
    className={cn(
      "bg-background sticky top-0 flex items-center justify-between gap-2 px-2 py-1.5 md:px-2",
      className
    )}
  >
    <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger
          // oxlint-disable-next-line react/forbid-component-props -- SidebarTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
          className="md:hidden"
        />
        {breadcrumb}
      </div>
      {actions}
    </div>
    <HeaderActions />
  </header>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-max-depth */
