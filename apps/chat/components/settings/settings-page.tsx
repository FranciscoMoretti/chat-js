"use client";
import React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SettingsPage: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SettingsPage = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SettingsPageHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SettingsPageHeader = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element => (
  <div className={cn("shrink-0", className)}>{children}</div>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SettingsPageContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SettingsPageContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element => (
  <div
    className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
  >
    {children}
  </div>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SettingsPageScrollArea: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SettingsPageScrollArea = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element => (
  <ScrollArea className={className}>{children}</ScrollArea>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
export {
  SettingsPage,
  SettingsPageContent,
  SettingsPageHeader,
  SettingsPageScrollArea,
};
