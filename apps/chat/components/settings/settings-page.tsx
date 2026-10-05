"use client";
import React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
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
  <ScrollArea className={className}>{children}</ScrollArea>
);
/* oxlint-enable react/no-multi-comp */
export {
  SettingsPage,
  SettingsPageContent,
  SettingsPageHeader,
  SettingsPageScrollArea,
};
