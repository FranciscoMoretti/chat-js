"use client";

import {
  Content as TabsPrimitiveContent,
  List as TabsPrimitiveList,
  Root as TabsPrimitiveRoot,
  Trigger as TabsPrimitiveTrigger,
} from "@radix-ui/react-tabs";
import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitiveRoot;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TabsList: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- TabsList uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TabsList = reactForwardRef<
  ReactComponentRef<typeof TabsPrimitiveList>,
  ReactComponentPropsWithoutRef<typeof TabsPrimitiveList>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <TabsPrimitiveList
    // oxlint-disable-next-line react/forbid-component-props -- TabsPrimitiveList accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-md p-1",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TabsList's TabsPrimitiveList prop contract, preserving caller options, children and callbacks.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TabsList.displayName = TabsPrimitiveList.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TabsTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- TabsTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TabsTrigger = reactForwardRef<
  ReactComponentRef<typeof TabsPrimitiveTrigger>,
  ReactComponentPropsWithoutRef<typeof TabsPrimitiveTrigger>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <TabsPrimitiveTrigger
    // oxlint-disable-next-line react/forbid-component-props -- TabsPrimitiveTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TabsTrigger's TabsPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TabsTrigger.displayName = TabsPrimitiveTrigger.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TabsContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- TabsContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TabsContent = reactForwardRef<
  ReactComponentRef<typeof TabsPrimitiveContent>,
  ReactComponentPropsWithoutRef<typeof TabsPrimitiveContent>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <TabsPrimitiveContent
    // oxlint-disable-next-line react/forbid-component-props -- TabsPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TabsContent's TabsPrimitiveContent prop contract, preserving caller options, children and callbacks.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TabsContent.displayName = TabsPrimitiveContent.displayName;

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Tabs, TabsContent, TabsList, TabsTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Tabs, TabsContent, TabsList, TabsTrigger };
/* oxlint-enable import/no-named-export */
