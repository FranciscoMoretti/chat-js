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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ComponentProps, JSX as ReactJSX, ReactNode } from "react";
import React, { isValidElement } from "react";
import { CodeBlock } from "./code-block";
import type { ToolUIPart } from "ai";
import { cn } from "@/lib/utils";

const TOOL_TITLE_SEGMENT_START_INDEX = 1;
const JSON_INDENT_SPACES = 2;

type ToolProps = ComponentProps<typeof Collapsible>;

const Tool = ({ className, ...props }: ToolProps): React.JSX.Element => (
  <Collapsible
    className={cn("not-prose mb-4 w-full rounded-md border", className)}
    {...props}
  />
);

interface ToolHeaderProps {
  title?: string;
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
}

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

const ToolHeader = ({
  className,
  title,
  type,
  state,
  ...props
}: Readonly<ToolHeaderProps>): React.JSX.Element => (
  <CollapsibleTrigger
    className={cn(
      "flex w-full items-center justify-between gap-4 p-3",
      className
    )}
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

type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

const ToolContent = ({
  className,
  ...props
}: ToolContentProps): React.JSX.Element => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
      className
    )}
    {...props}
  />
);

type ToolInputProps = ComponentProps<"div"> & {
  input: ToolUIPart["input"];
};

const ToolInput = ({
  className,
  input,
  ...props
}: ToolInputProps): React.JSX.Element => (
  <div className={cn("space-y-2 overflow-hidden p-4", className)} {...props}>
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

type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolUIPart["output"];
  errorText: ToolUIPart["errorText"];
};

const getToolOutputContent = (output: ToolOutputProps["output"]): ReactNode => {
  const initialOutput =
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

const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps): React.JSX.Element | null => {
  if (
    output === undefined &&
    (typeof errorText !== "string" || errorText === "")
  ) {
    return null;
  }

  const outputContent = getToolOutputContent(output);

  return (
    <div className={cn("space-y-2 p-4", className)} {...props}>
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
        {getToolErrorText(errorText)}
        {outputContent}
      </div>
    </div>
  );
};
export { getStatusBadge, Tool, ToolContent, ToolHeader, ToolInput, ToolOutput };
export type {
  ToolContentProps,
  ToolHeaderProps,
  ToolInputProps,
  ToolOutputProps,
  ToolProps,
};
