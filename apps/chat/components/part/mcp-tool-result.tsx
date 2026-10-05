"use client";

import type { DynamicToolUIPart } from "ai";
import React from "react";
import type { ReactNode } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { McpToolHeader } from "@/components/ai-elements/extra/mcp-tool-header";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Tool,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
/* oxlint-enable sort-imports */
import { parseToolId } from "@/lib/ai/mcp-name-id";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (McpToolResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types -- no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
}): React.JSX.Element => {
  const parsed = parseToolId(part.toolName);
  return (
    <Tool defaultOpen={defaultOpen}>
      <McpToolHeader
        icon={icon}
        state={part.state}
        title={
          part.title /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading toolName from parsed; preserve one receiver evaluation, skipped accesses and the existing parsed?.toolName fallback. The app guidance prefers optional chaining. */ ??
          parsed?.toolName ??
          /* oxlint-enable oxc/no-optional-chaining */ part.toolName
        }
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types */
