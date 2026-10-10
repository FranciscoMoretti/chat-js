"use client";

import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
/* oxlint-disable sort-imports -- Badge initializes utils/UUID crypto.randomUUID capture before Collapsible initializes ReactDOM DevTools/checkDCE; preserve the original cold loader schedule. */
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
/* oxlint-enable sort-imports */
import type { ComponentProps, JSX as ReactJSX, ReactNode } from "react";
import React, { isValidElement } from "react";
import { CodeBlock } from "./code-block";
import type { ToolUIPart } from "ai";
import { cn } from "@/lib/utils";

const TOOL_TITLE_SEGMENT_START_INDEX = 1;
const JSON_INDENT_SPACES = 2;

type ToolProps = ComponentProps<typeof Collapsible>;

/* oxlint-disable react/forbid-component-props -- Collapsible accept the supplied styling props; preserve this composition's layout and appearance. */
const Tool = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Keep this exported component on its existing public prop type; a deep-readonly mapping changes its inferred ComponentProps surface and would alter the public type contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ToolProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <Collapsible
    className={cn("not-prose mb-4 w-full rounded-md border", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Tool's Collapsible prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/forbid-component-props */

interface ToolHeaderProps {
  title?: string;
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
}

/* oxlint-disable react/forbid-component-props -- ClockIcon, CheckCircleIcon, CircleIcon, XCircleIcon, Badge accept the supplied styling props; preserve this composition's layout and appearance. */
const getStatusBadge = (status: ToolUIPart["state"]): ReactJSX.Element => {
  const labels: Record<ToolUIPart["state"], string> = {
    "approval-requested": "Awaiting Approval",
    "approval-responded": "Responded",
    "input-available": "Running",
    "input-streaming": "Pending",
    "output-available": "Completed",
    "output-denied": "Denied",
    "output-error": "Error",
  };

  const icons: Record<ToolUIPart["state"], ReactNode> = {
    "approval-requested": <ClockIcon className="size-4 text-yellow-600" />,
    "approval-responded": <CheckCircleIcon className="size-4 text-blue-600" />,
    "input-available": <ClockIcon className="size-4 animate-pulse" />,
    "input-streaming": <CircleIcon className="size-4" />,
    "output-available": <CheckCircleIcon className="size-4 text-green-600" />,
    "output-denied": <XCircleIcon className="size-4 text-orange-600" />,
    "output-error": <XCircleIcon className="size-4 text-red-600" />,
  };

  return (
    <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
      {icons[status]}
      {labels[status]}
    </Badge>
  );
};
/* oxlint-enable react/forbid-component-props */

/* oxlint-disable react/no-multi-comp -- ToolHeader is part of this compound component module. */

/* oxlint-disable react/forbid-component-props -- CollapsibleTrigger, WrenchIcon, ChevronDownIcon accept the supplied styling props; preserve this composition's layout and appearance. */
const ToolHeader = ({
  className,
  title,
  type,
  state,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, title, type, state from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: Readonly<ToolHeaderProps>): React.JSX.Element => (
  <CollapsibleTrigger
    className={cn(
      "flex w-full items-center justify-between gap-4 p-3",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- ToolHeader forwards extra caller object properties to CollapsibleTrigger; removing the rest spread would drop existing events and data attributes.
    {...props}
  >
    <div className="flex items-center gap-2">
      <WrenchIcon className="text-muted-foreground size-4" />
      <span className="text-sm font-medium">
        {title ??
          type.split("-").slice(TOOL_TITLE_SEGMENT_START_INDEX).join("-")}
      </span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/no-multi-comp */

type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

/* oxlint-disable react/no-multi-comp -- ToolContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/forbid-component-props -- CollapsibleContent accept the supplied styling props; preserve this composition's layout and appearance. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Keep this exported component on its existing public prop type; a deep-readonly mapping changes its inferred ComponentProps surface and would alter the public type contract. */
const ToolContent = ({
  className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ToolContentProps): React.JSX.Element => (
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ToolContent's CollapsibleContent prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/no-multi-comp */

type ToolInputProps = ComponentProps<"div"> & {
  input: ToolUIPart["input"];
};
/* oxlint-disable react/jsx-no-literals -- ToolInput renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable react/no-multi-comp, unicorn/no-null -- ToolInput belongs with its related tool components, and null remains a valid empty React render sentinel. */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Keep this exported component on its existing public prop type; a deep-readonly mapping changes its inferred ComponentProps surface and would alter the public type contract. */
const ToolInput = ({
  className,
  input,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, input from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ToolInputProps): React.JSX.Element => (
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
  <div
    className={cn("space-y-2 overflow-hidden p-4", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ToolInput's native div attributes, preserving caller events and accessibility props.
    {...props}
  >
    <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      Parameters
    </h4>
    <div className="bg-muted/50 rounded-md">
      <CodeBlock
        code={JSON.stringify(input, null, JSON_INDENT_SPACES)}
        language="json"
      />
    </div>
  </div>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/no-multi-comp, unicorn/no-null */

type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolUIPart["output"];
  errorText: ToolUIPart["errorText"];
};

/* oxlint-disable no-undefined, react/no-multi-comp, unicorn/no-null -- ToolOutput and its helpers preserve undefined as an absent optional output/error, null as a React empty-render value, and empty output or errorText as the existing fallback; they stay beside the related tool components. */
const getToolOutputContent = (output: ToolOutputProps["output"]): ReactNode => {
  const initialOutput =
    // oxlint-disable-next-line no-ternary -- Preserve the native React element/bigint rendering branch and null empty-render sentinel.
    isValidElement(output) || typeof output === "bigint" ? output : null;

  if (
    (typeof output === "object" && !isValidElement(output)) ||
    typeof output === "boolean" ||
    typeof output === "number"
  ) {
    return (
      <CodeBlock
        code={JSON.stringify(output, null, JSON_INDENT_SPACES)}
        language="json"
      />
    );
  }

  if (typeof output === "string") {
    // oxlint-disable-next-line no-ternary -- Keep code JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    return <CodeBlock code={output === "" ? '""' : output} language="json" />;
  }

  return <div>{initialOutput}</div>;
};

const getToolErrorText = (
  errorText: ToolOutputProps["errorText"]
): ReactNode => {
  if (typeof errorText !== "string" || errorText === "") {
    return errorText;
  }

  return <div>{errorText}</div>;
};

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Keep this exported component on its existing public prop type; a deep-readonly mapping changes its inferred ComponentProps surface and would alter the public type contract. */
const ToolOutput = ({
  className,
  output,
  errorText,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, output, errorText from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ToolOutputProps): React.JSX.Element | null => {
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
  if (
    output === undefined &&
    (typeof errorText !== "string" || errorText === "")
  ) {
    return null;
  }

  const outputContent = getToolOutputContent(output);

  return (
    <div
      className={cn("space-y-2 p-4", className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ToolOutput's native div attributes, preserving caller events and accessibility props.
      {...props}
    >
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          typeof errorText === "string" && errorText !== "" ? "Error" : "Result"
        }
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          // oxlint-disable-next-line no-ternary -- Keep cn argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          typeof errorText === "string" && errorText !== ""
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {getToolErrorText(errorText)}
        {outputContent}
      </div>
    </div>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getStatusBadge, Tool, ToolContent, ToolHeader, ToolInput, ToolOutput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-undefined, react/no-multi-comp, unicorn/no-null */
/* oxlint-disable react/only-export-components -- #620: Consumers import getStatusBadge, Tool, ToolContent, ToolHeader, ToolInput, ToolOutput from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { getStatusBadge, Tool, ToolContent, ToolHeader, ToolInput, ToolOutput };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ToolContentProps, ToolHeaderProps, ToolInputProps, ToolOutputProps, ToolProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/only-export-components */
export type {
  ToolContentProps,
  ToolHeaderProps,
  ToolInputProps,
  ToolOutputProps,
  ToolProps,
};
/* oxlint-enable import/no-named-export */
