"use client";

import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
import {
  Content as TabsPrimitiveContent,
  List as TabsPrimitiveList,
  Root as TabsPrimitiveRoot,
  Trigger as TabsPrimitiveTrigger,
} from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

const Tabs = TabsPrimitiveRoot;

const TabsList = reactForwardRef<
  ReactComponentRef<typeof TabsPrimitiveList>,
  ReactComponentPropsWithoutRef<typeof TabsPrimitiveList>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <TabsPrimitiveList
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-md p-1",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

TabsList.displayName = TabsPrimitiveList.displayName;

const TabsTrigger = reactForwardRef<
  ReactComponentRef<typeof TabsPrimitiveTrigger>,
  ReactComponentPropsWithoutRef<typeof TabsPrimitiveTrigger>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <TabsPrimitiveTrigger
      className={cn(
        "ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

TabsTrigger.displayName = TabsPrimitiveTrigger.displayName;

const TabsContent = reactForwardRef<
  ReactComponentRef<typeof TabsPrimitiveContent>,
  ReactComponentPropsWithoutRef<typeof TabsPrimitiveContent>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <TabsPrimitiveContent
      className={cn(
        "ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

TabsContent.displayName = TabsPrimitiveContent.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
