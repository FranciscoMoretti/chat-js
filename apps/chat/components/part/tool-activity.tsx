"use client";

import React from "react";
import type { ToolUIPart } from "ai";
import { WrenchIcon } from "lucide-react";
import type { ReadonlyReactNode } from "../../lib/readonly-react-node";
import {
  Trace,
  TraceLine,
  TraceIcon,
  TraceTitle,
  TraceDescription,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
} from "../ui/trace";

const defaultPrimitives = {
  Trace,
  TraceLine,
  TraceIcon,
  TraceTitle,
  TraceDescription,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
};

// The composition only consumes these props; it does not depend on either
// library's controlled-open event signature or render/asChild escape hatch.
type ActivityPrimitives = Omit<
  typeof defaultPrimitives,
  "TraceCollapsible" | "TraceCollapsibleTrigger" | "TraceCollapsibleContent"
> & {
  TraceCollapsible: React.ComponentType<
    React.PropsWithChildren<{ defaultOpen?: boolean }>
  >;
  TraceCollapsibleTrigger: React.ComponentType<React.PropsWithChildren>;
  TraceCollapsibleContent: React.ComponentType<
    React.PropsWithChildren<{ className?: string }>
  >;
};

const labels: Record<ToolUIPart["state"], string> = {
  "approval-requested": "Awaiting approval",
  "approval-responded": "Responded",
  "input-available": "Running",
  "input-streaming": "Pending",
  "output-available": "Completed",
  "output-denied": "Denied",
  "output-error": "Error",
};

const traceStatus: Partial<
  Record<ToolUIPart["state"], "running" | "error" | "pending">
> = {
  "input-streaming": "pending",
  "input-available": "running",
  "output-error": "error",
};

export const ToolActivity = ({
  title,
  state,
  icon,
  defaultOpen = false,
  children,
  primitives = defaultPrimitives,
}: {
  readonly primitives?: ActivityPrimitives;
  readonly title: string;
  readonly state: ToolUIPart["state"];
  readonly icon?: ReadonlyReactNode;
  readonly defaultOpen?: boolean;
  readonly children: ReadonlyReactNode;
}): React.JSX.Element => (
  <primitives.Trace>
    <primitives.TraceCollapsible defaultOpen={defaultOpen}>
      <primitives.TraceCollapsibleTrigger>
        <primitives.TraceLine status={traceStatus[state]}>
          <primitives.TraceIcon>{icon ?? <WrenchIcon />}</primitives.TraceIcon>
          <primitives.TraceTitle>{title}</primitives.TraceTitle>
          <primitives.TraceDescription>
            {labels[state]}
          </primitives.TraceDescription>
        </primitives.TraceLine>
      </primitives.TraceCollapsibleTrigger>
      <primitives.TraceCollapsibleContent className="space-y-3">
        {children}
      </primitives.TraceCollapsibleContent>
    </primitives.TraceCollapsible>
  </primitives.Trace>
);
