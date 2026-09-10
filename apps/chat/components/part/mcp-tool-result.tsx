"use client";
import type { DynamicToolUIPart } from "ai";
import type { ReactNode } from "react";
import { McpToolHeader } from "@/components/ai-elements/extra/mcp-tool-header";
import {
  Tool,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { parseToolId } from "@/lib/ai/mcp-name-id";

export function McpToolResult({
  part,
  icon,
  defaultOpen = false,
}: {
  part: Pick<DynamicToolUIPart, "toolName" | "title" | "state" | "input"> & {
    output?: unknown;
    errorText?: string;
  };
  icon?: ReactNode;
  defaultOpen?: boolean;
}) {
  const parsed = parseToolId(part.toolName);
  return (
    <Tool defaultOpen={defaultOpen}>
      <McpToolHeader
        icon={icon}
        state={part.state}
        title={part.title ?? parsed?.toolName ?? part.toolName}
        type={`tool-${part.toolName}`}
      />
      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput
          errorText={part.state === "output-error" ? part.errorText : undefined}
          output={part.state === "output-available" ? part.output : undefined}
        />
      </ToolContent>
    </Tool>
  );
}
