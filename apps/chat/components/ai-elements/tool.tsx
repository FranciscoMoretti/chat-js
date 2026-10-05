"use client";

import type { ToolUIPart } from "ai";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
/* oxlint-enable sort-imports */
import type { ComponentProps, JSX as ReactJSX, ReactNode } from "react";
import React, { isValidElement } from "react";

import { Badge } from "@/components/ui/badge";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { CodeBlock } from "./code-block";
/* oxlint-enable sort-imports */

type ToolProps = ComponentProps<typeof Collapsible>;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Tool: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ToolProps). */

/* oxlint-disable react/forbid-component-props -- Collapsible accept the supplied styling props; preserve this composition's layout and appearance. */
const Tool = ({ className, ...props }: ToolProps): React.JSX.Element => (
  <Collapsible
    className={cn("not-prose mb-4 w-full rounded-md border", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Tool's Collapsible prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

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

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ToolHeader: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/forbid-component-props -- CollapsibleTrigger, WrenchIcon, ChevronDownIcon accept the supplied styling props; preserve this composition's layout and appearance. */
const ToolHeader = ({
  className,
  title,
  type,
  state,
  ...props
}: ToolHeaderProps): React.JSX.Element => (
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
        {title ?? type.split("-").slice(1).join("-")}
      </span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ToolContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ToolContentProps). */

/* oxlint-disable react/forbid-component-props -- CollapsibleContent accept the supplied styling props; preserve this composition's layout and appearance. */
const ToolContent = ({
  className,
  ...props
}: ToolContentProps): React.JSX.Element => (
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ToolInputProps = ComponentProps<"div"> & {
  input: ToolUIPart["input"];
};
/* oxlint-disable react/jsx-no-literals -- ToolInput renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ToolInput: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, input, ...props }: ToolInputProps); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ToolInput = ({
  className,
  input,
  ...props
}: ToolInputProps): React.JSX.Element => (
  <div
    className={cn("space-y-2 overflow-hidden p-4", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ToolInput's native div attributes, preserving caller events and accessibility props.
    {...props}
  >
    <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      Parameters
    </h4>
    <div className="bg-muted/50 rounded-md">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null */

type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolUIPart["output"];
  errorText: ToolUIPart["errorText"];
};

/* oxlint-disable no-magic-numbers, no-undefined, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- ToolOutput: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including errorText); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps): React.JSX.Element | null => {
  if (output === undefined && !errorText) {
    return null;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Tool output accepts caller-provided renderable content; replacing the rendering assertion requires defining the supported output-value contract.
  let Output = <div>{output as ReactNode}</div>;

  if (
    (typeof output === "object" && !isValidElement(output)) ||
    typeof output === "boolean" ||
    typeof output === "number"
  ) {
    Output = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
    );
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output === "" ? '""' : output} language="json" />;
  }

  return (
    <div
      className={cn("space-y-2 p-4", className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ToolOutput's native div attributes, preserving caller events and accessibility props.
      {...props}
    >
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {typeof errorText === "string" && errorText !== "" ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          typeof errorText === "string" && errorText !== ""
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getStatusBadge, Tool, ToolContent, ToolHeader, ToolInput, ToolOutput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-magic-numbers, no-undefined, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
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
