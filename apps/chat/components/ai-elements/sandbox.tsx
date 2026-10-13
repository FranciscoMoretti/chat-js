"use client";

import { ChevronDownIcon, Code } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CodeBlock, CodeBlockCopyButton } from "./code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ComponentProps } from "react";
import React from "react";
import type { ToolUIPart } from "ai";
import { cn } from "@/lib/utils";
import { getStatusBadge } from "./tool";

type SandboxRootProps = ComponentProps<typeof Collapsible>;

const Sandbox = ({
  className,
  ...props
}: SandboxRootProps): React.JSX.Element => (
  <Collapsible
    className={cn("not-prose group mb-4 w-full rounded-md border", className)}
    defaultOpen
    {...props}
  />
);

interface SandboxHeaderProps {
  title?: string;
  state: ToolUIPart["state"];
  className?: string;
}

const SandboxHeader = ({
  className,
  title,
  state,
  ...props
}: Readonly<SandboxHeaderProps>): React.JSX.Element => (
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

type SandboxContentProps = ComponentProps<typeof CollapsibleContent>;

const SandboxContent = ({
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

type SandboxTabsProps = ComponentProps<typeof Tabs>;

const SandboxTabs = ({
  className,
  ...props
}: SandboxTabsProps): React.JSX.Element => (
  <Tabs className={cn("w-full", className)} {...props} />
);

type SandboxTabsBarProps = ComponentProps<"div">;

const SandboxTabsBar = ({
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

type SandboxTabsListProps = ComponentProps<typeof TabsList>;

const SandboxTabsList = ({
  className,
  ...props
}: SandboxTabsListProps): React.JSX.Element => (
  <TabsList
    className={cn("h-auto rounded-none border-0 bg-transparent p-0", className)}
    {...props}
  />
);

type SandboxTabsTriggerProps = ComponentProps<typeof TabsTrigger>;

const SandboxTabsTrigger = ({
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

type SandboxTabContentProps = ComponentProps<typeof TabsContent>;

const SandboxTabContent = ({
  className,
  ...props
}: SandboxTabContentProps): React.JSX.Element => (
  <TabsContent className={cn("mt-0 text-sm", className)} {...props} />
);

type SandboxCodeProps = ComponentProps<typeof CodeBlock>;

const SandboxCode = ({
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

type SandboxOutputProps = Omit<ComponentProps<typeof CodeBlock>, "language">;

const SandboxOutput = ({
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
