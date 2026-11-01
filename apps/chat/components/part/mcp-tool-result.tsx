"use client";

import { ToolActivity } from "@/components/part/tool-activity";
import { ToolInput, ToolOutput } from "@/components/part/tool-data";
import type { DynamicToolUIPart } from "ai";

import React from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { parseToolId } from "@/lib/ai/mcp-name-id";

export const McpToolResult = ({
  part,
  icon,
  defaultOpen = false,
}: {
  readonly part: Pick<
    DynamicToolUIPart,
    "toolName" | "title" | "state" | "input"
  > & {
    readonly output?: unknown;
    readonly errorText?: string;
  };
  readonly icon?: ReadonlyReactNode;
  readonly defaultOpen?: boolean;
}): React.JSX.Element => {
  const parsed = parseToolId(part.toolName);
  return (
    <ToolActivity
      defaultOpen={defaultOpen}
      icon={icon}
      state={part.state}
      title={part.title ?? parsed?.toolName ?? part.toolName}
    >
      <ToolInput input={part.input} />
      <ToolOutput
        errorText={part.state === "output-error" ? part.errorText : undefined}
        output={part.state === "output-available" ? part.output : undefined}
      />
    </ToolActivity>
  );
};
