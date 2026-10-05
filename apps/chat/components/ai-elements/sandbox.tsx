"use client";

import type { ToolUIPart } from "ai";
import { ChevronDownIcon, Code } from "lucide-react";
import React from "react";
import type { ComponentProps } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { CodeBlock, CodeBlockCopyButton } from "./code-block";
import { getStatusBadge } from "./tool";

type SandboxRootProps = ComponentProps<typeof Collapsible>;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Sandbox: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxRootProps). */

const Sandbox = ({
  className,
  ...props
}: SandboxRootProps): React.JSX.Element => (
  <Collapsible
    className={cn("not-prose group mb-4 w-full rounded-md border", className)}
    defaultOpen
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Sandbox's Collapsible prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

interface SandboxHeaderProps {
  title?: string;
  state: ToolUIPart["state"];
  className?: string;
}

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SandboxHeader = ({
  className,
  title,
  state,
  ...props
}: SandboxHeaderProps): React.JSX.Element => (
  <CollapsibleTrigger
    className={cn(
      "flex w-full items-center justify-between gap-4 p-3",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- SandboxHeader forwards extra caller object properties to CollapsibleTrigger; removing the rest spread would drop existing events and data attributes.
    {...props}
  >
    <div className="flex items-center gap-2">
      <Code className="text-muted-foreground size-4" />
      <span className="text-sm font-medium">{title}</span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type SandboxContentProps = ComponentProps<typeof CollapsibleContent>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxContentProps). */

const SandboxContent = ({
  className,
  ...props
}: SandboxContentProps): React.JSX.Element => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SandboxContent's CollapsibleContent prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type SandboxTabsProps = ComponentProps<typeof Tabs>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxTabs: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxTabsProps). */

const SandboxTabs = ({
  className,
  ...props
}: SandboxTabsProps): React.JSX.Element => (
  <Tabs
    className={cn("w-full", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SandboxTabs's Tabs prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type SandboxTabsBarProps = ComponentProps<"div">;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxTabsBar: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxTabsBarProps). */

const SandboxTabsBar = ({
  className,
  ...props
}: SandboxTabsBarProps): React.JSX.Element => (
  <div
    className={cn(
      "border-border flex w-full items-center border-t border-b",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SandboxTabsBar's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type SandboxTabsListProps = ComponentProps<typeof TabsList>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxTabsList: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxTabsListProps). */

const SandboxTabsList = ({
  className,
  ...props
}: SandboxTabsListProps): React.JSX.Element => (
  <TabsList
    className={cn("h-auto rounded-none border-0 bg-transparent p-0", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SandboxTabsList's TabsList prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type SandboxTabsTriggerProps = ComponentProps<typeof TabsTrigger>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxTabsTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxTabsTriggerProps). */

const SandboxTabsTrigger = ({
  className,
  ...props
}: SandboxTabsTriggerProps): React.JSX.Element => (
  <TabsTrigger
    className={cn(
      "text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none border-0 border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SandboxTabsTrigger's TabsTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type SandboxTabContentProps = ComponentProps<typeof TabsContent>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxTabContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxTabContentProps). */

const SandboxTabContent = ({
  className,
  ...props
}: SandboxTabContentProps): React.JSX.Element => (
  <TabsContent
    className={cn("mt-0 text-sm", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SandboxTabContent's TabsContent prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type SandboxCodeProps = ComponentProps<typeof CodeBlock>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxCode: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxCodeProps). */

const SandboxCode = ({
  className,
  ...props
}: SandboxCodeProps): React.JSX.Element => (
  <CodeBlock
    className={cn("min-h-10 border-0", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SandboxCode's CodeBlock prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <CodeBlockCopyButton
      className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      size="sm"
    />
  </CodeBlock>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type SandboxOutputProps = Omit<ComponentProps<typeof CodeBlock>, "language">;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxOutput: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxOutputProps). */

const SandboxOutput = ({
  className,
  ...props
}: SandboxOutputProps): React.JSX.Element => (
  <CodeBlock
    className={cn("min-h-10 border-0", className)}
    language="log"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SandboxOutput's CodeBlock prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <CodeBlockCopyButton
      className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      size="sm"
    />
  </CodeBlock>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
export {
  Sandbox,
  SandboxCode,
  SandboxContent,
  SandboxHeader,
  SandboxOutput,
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
};
export type {
  SandboxCodeProps,
  SandboxContentProps,
  SandboxHeaderProps,
  SandboxOutputProps,
  SandboxRootProps,
  SandboxTabContentProps,
  SandboxTabsBarProps,
  SandboxTabsListProps,
  SandboxTabsProps,
  SandboxTabsTriggerProps,
};
