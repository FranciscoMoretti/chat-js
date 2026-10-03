"use client";

/* oxlint-disable import/no-namespace -- @radix-ui/react-tabs import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as TabsPrimitive from "@radix-ui/react-tabs";
/* oxlint-enable import/no-namespace */
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TabsList: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref): React.JSX.Element => (
  <TabsPrimitive.List
    className={cn(
      "bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-md p-1",
      className
    )}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TabsList.displayName = TabsPrimitive.List.displayName;
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TabsTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref): React.JSX.Element => (
  <TabsPrimitive.Trigger
    className={cn(
      "ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm",
      className
    )}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TabsContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref): React.JSX.Element => (
  <TabsPrimitive.Content
    className={cn(
      "ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      className
    )}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
