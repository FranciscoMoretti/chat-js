"use client";

import type { DynamicToolUIPart } from "ai";
import React from "react";
import type { ReactNode } from "react";

import { McpToolHeader } from "@/components/ai-elements/extra/mcp-tool-header";
import {
  Tool,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { parseToolId } from "@/lib/ai/mcp-name-id";
/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- McpToolResult: ; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const McpToolResult = ({
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
}) => {
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
};
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
