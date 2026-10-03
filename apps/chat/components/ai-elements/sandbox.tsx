"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

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
/* oxlint-enable sort-imports */
/* oxlint-disable import/group-exports, import/no-named-export -- SandboxRootProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type SandboxRootProps = ComponentProps<typeof Collapsible>;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Sandbox: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxRootProps). */

export const Sandbox = ({
  className,
  ...props
}: SandboxRootProps): React.JSX.Element => (
  <Collapsible
    className={cn("not-prose group mb-4 w-full rounded-md border", className)}
    defaultOpen
    {...props}
  />
);
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export -- SandboxHeaderProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export interface SandboxHeaderProps {
  title?: string;
  state: ToolUIPart["state"];
  className?: string;
}
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxHeader: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const SandboxHeader = ({
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
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export -- SandboxContentProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type SandboxContentProps = ComponentProps<typeof CollapsibleContent>;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxContent: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxContentProps). */

export const SandboxContent = ({
  className,
  ...props
}: SandboxContentProps): React.JSX.Element => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
      className
    )}
    {...props}
  />
);
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export -- SandboxTabsProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type SandboxTabsProps = ComponentProps<typeof Tabs>;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxTabs: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxTabsProps). */

export const SandboxTabs = ({
  className,
  ...props
}: SandboxTabsProps): React.JSX.Element => (
  <Tabs className={cn("w-full", className)} {...props} />
);
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export -- SandboxTabsBarProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type SandboxTabsBarProps = ComponentProps<"div">;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxTabsBar: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxTabsBarProps). */

export const SandboxTabsBar = ({
  className,
  ...props
}: SandboxTabsBarProps): React.JSX.Element => (
  <div
    className={cn(
      "border-border flex w-full items-center border-t border-b",
      className
    )}
    {...props}
  />
);
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export -- SandboxTabsListProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type SandboxTabsListProps = ComponentProps<typeof TabsList>;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxTabsList: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxTabsListProps). */

export const SandboxTabsList = ({
  className,
  ...props
}: SandboxTabsListProps): React.JSX.Element => (
  <TabsList
    className={cn("h-auto rounded-none border-0 bg-transparent p-0", className)}
    {...props}
  />
);
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export -- SandboxTabsTriggerProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type SandboxTabsTriggerProps = ComponentProps<typeof TabsTrigger>;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxTabsTrigger: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxTabsTriggerProps). */

export const SandboxTabsTrigger = ({
  className,
  ...props
}: SandboxTabsTriggerProps): React.JSX.Element => (
  <TabsTrigger
    className={cn(
      "text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none border-0 border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none",
      className
    )}
    {...props}
  />
);
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export -- SandboxTabContentProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type SandboxTabContentProps = ComponentProps<typeof TabsContent>;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxTabContent: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxTabContentProps). */

export const SandboxTabContent = ({
  className,
  ...props
}: SandboxTabContentProps): React.JSX.Element => (
  <TabsContent className={cn("mt-0 text-sm", className)} {...props} />
);
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export -- SandboxCodeProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type SandboxCodeProps = ComponentProps<typeof CodeBlock>;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxCode: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxCodeProps). */

export const SandboxCode = ({
  className,
  ...props
}: SandboxCodeProps): React.JSX.Element => (
  <CodeBlock className={cn("min-h-10 border-0", className)} {...props}>
    <CodeBlockCopyButton
      className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      size="sm"
    />
  </CodeBlock>
);
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export -- SandboxOutputProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type SandboxOutputProps = Omit<
  ComponentProps<typeof CodeBlock>,
  "language"
>;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SandboxOutput: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: SandboxOutputProps). */

export const SandboxOutput = ({
  className,
  ...props
}: SandboxOutputProps): React.JSX.Element => (
  <CodeBlock
    className={cn("min-h-10 border-0", className)}
    language="log"
    {...props}
  >
    <CodeBlockCopyButton
      className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      size="sm"
    />
  </CodeBlock>
);
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
