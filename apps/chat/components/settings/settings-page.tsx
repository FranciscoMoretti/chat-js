"use client";
import React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types -- SettingsPage: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const SettingsPage = ({
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SettingsPageHeader: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const SettingsPageHeader = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element => (
  <div className={cn("shrink-0", className)}>{children}</div>
);
/* oxlint-enable import/group-exports, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SettingsPageContent: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const SettingsPageContent = ({
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
/* oxlint-enable import/group-exports, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SettingsPageScrollArea: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const SettingsPageScrollArea = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element => (
  <ScrollArea className={className}>{children}</ScrollArea>
);
/* oxlint-enable import/group-exports, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
