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

const SettingsPageHeader = ({
  children,
  className,
}: {
  readonly children: ReadonlyReactNode;
  readonly className?: string;
}): React.JSX.Element => (
  <div className={cn("shrink-0", className)}>{children}</div>
);

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

const SettingsPageScrollArea = ({
  children,
  className,
}: {
  readonly children: ReadonlyReactNode;
  readonly className?: string;
}): React.JSX.Element => (
  <ScrollArea className={className}>{children}</ScrollArea>
);
export {
  SettingsPage,
  SettingsPageContent,
  SettingsPageHeader,
  SettingsPageScrollArea,
};
