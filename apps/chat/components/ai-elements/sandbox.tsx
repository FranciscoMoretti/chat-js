"use client";

import type { ToolUIPart } from "ai";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ChevronDownIcon, Code } from "lucide-react";
/* oxlint-enable sort-imports */
import type { ComponentProps } from "react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
/* oxlint-enable sort-imports */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { CodeBlock, CodeBlockCopyButton } from "./code-block";
/* oxlint-enable sort-imports */
import { getStatusBadge } from "./tool";

type SandboxRootProps = ComponentProps<typeof Collapsible>;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Sandbox: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxRootProps). */

const Sandbox = ({
  className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SandboxRootProps): React.JSX.Element => (
  <Collapsible
    // oxlint-disable-next-line react/forbid-component-props -- Collapsible accepts className in its styling contract; preserve this caller's layout and appearance.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, title, state from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SandboxHeaderProps): React.JSX.Element => (
  <CollapsibleTrigger
    // oxlint-disable-next-line react/forbid-component-props -- CollapsibleTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "flex w-full items-center justify-between gap-4 p-3",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- SandboxHeader forwards extra caller object properties to CollapsibleTrigger; removing the rest spread would drop existing events and data attributes.
    {...props}
  >
    <div className="flex items-center gap-2">
      <Code
        // oxlint-disable-next-line react/forbid-component-props -- Code accepts className in its styling contract; preserve this caller's layout and appearance.
        className="text-muted-foreground size-4"
      />
      <span className="text-sm font-medium">{title}</span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon
      // oxlint-disable-next-line react/forbid-component-props -- ChevronDownIcon accepts className in its styling contract; preserve this caller's layout and appearance.
      className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180"
    />
  </CollapsibleTrigger>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type SandboxContentProps = ComponentProps<typeof CollapsibleContent>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxContentProps). */

const SandboxContent = ({
  className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SandboxContentProps): React.JSX.Element => (
  <CollapsibleContent
    // oxlint-disable-next-line react/forbid-component-props -- CollapsibleContent accepts className in its styling contract; preserve this caller's layout and appearance.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SandboxTabsProps): React.JSX.Element => (
  <Tabs
    // oxlint-disable-next-line react/forbid-component-props -- Tabs accepts className in its styling contract; preserve this caller's layout and appearance.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SandboxTabsListProps): React.JSX.Element => (
  <TabsList
    // oxlint-disable-next-line react/forbid-component-props -- TabsList accepts className in its styling contract; preserve this caller's layout and appearance.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SandboxTabsTriggerProps): React.JSX.Element => (
  <TabsTrigger
    // oxlint-disable-next-line react/forbid-component-props -- TabsTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SandboxTabContentProps): React.JSX.Element => (
  <TabsContent
    // oxlint-disable-next-line react/forbid-component-props -- TabsContent accepts className in its styling contract; preserve this caller's layout and appearance.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SandboxCodeProps): React.JSX.Element => (
  <CodeBlock
    // oxlint-disable-next-line react/forbid-component-props -- CodeBlock accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("min-h-10 border-0", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SandboxCode's CodeBlock prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <CodeBlockCopyButton
      // oxlint-disable-next-line react/forbid-component-props -- CodeBlockCopyButton accepts className in its styling contract; preserve this caller's layout and appearance.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SandboxOutputProps): React.JSX.Element => (
  <CodeBlock
    // oxlint-disable-next-line react/forbid-component-props -- CodeBlock accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("min-h-10 border-0", className)}
    language="log"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SandboxOutput's CodeBlock prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <CodeBlockCopyButton
      // oxlint-disable-next-line react/forbid-component-props -- CodeBlockCopyButton accepts className in its styling contract; preserve this caller's layout and appearance.
      className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      size="sm"
    />
  </CodeBlock>
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Sandbox, SandboxCode, SandboxContent, SandboxHeader, SandboxOutput, SandboxTabContent, SandboxTabs, SandboxTabsBar, SandboxTabsList, SandboxTabsTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (SandboxCodeProps, SandboxContentProps, SandboxHeaderProps, SandboxOutputProps, SandboxRootProps, SandboxTabContentProps, SandboxTabsBarProps, SandboxTabsListProps, SandboxTabsProps, SandboxTabsTriggerProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/no-named-export */
