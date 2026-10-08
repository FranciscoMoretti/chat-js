"use client";
import React from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const SettingsPage = ({
  children,
  className,
}: {
  readonly children: ReadonlyReactNode;
  readonly className?: string;
}): React.JSX.Element => (
  <div
    className={cn(
      "flex min-h-0 flex-1 flex-col gap-6 overflow-hidden",
      className
    )}
  >
    {children}
  </div>
);

/* oxlint-disable react/no-multi-comp -- SettingsPageHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const SettingsPageHeader = ({
  children,
  className,
}: {
  readonly children: ReadonlyReactNode;
  readonly className?: string;
}): React.JSX.Element => (
  <div className={cn("shrink-0", className)}>{children}</div>
);
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- SettingsPageContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const SettingsPageContent = ({
  children,
  className,
}: {
  readonly children: ReadonlyReactNode;
  readonly className?: string;
}): React.JSX.Element => (
  <div
    className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
  >
    {children}
  </div>
);
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- SettingsPageScrollArea: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const SettingsPageScrollArea = ({
  children,
  className,
}: {
  readonly children: ReadonlyReactNode;
  readonly className?: string;
}): React.JSX.Element => (
  <ScrollArea
    // oxlint-disable-next-line react/forbid-component-props -- ScrollArea accepts className in its styling contract; preserve this caller's layout and appearance.
    className={className}
  >
    {children}
  </ScrollArea>
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (SettingsPage, SettingsPageContent, SettingsPageHeader, SettingsPageScrollArea); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/no-multi-comp */
export {
  SettingsPage,
  SettingsPageContent,
  SettingsPageHeader,
  SettingsPageScrollArea,
};
/* oxlint-enable import/no-named-export */
