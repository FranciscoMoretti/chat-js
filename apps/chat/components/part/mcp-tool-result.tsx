"use client";

import {
  Tool,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import type { DynamicToolUIPart } from "ai";

import { McpToolHeader } from "@/components/ai-elements/extra/mcp-tool-header";

import React from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { parseToolId } from "@/lib/ai/mcp-name-id";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (McpToolResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-undefined -- no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value */

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
          // oxlint-disable-next-line no-ternary -- Keep errorText JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          errorText={part.state === "output-error" ? part.errorText : undefined}
          // oxlint-disable-next-line no-ternary -- Keep output JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          output={part.state === "output-available" ? part.output : undefined}
        />
      </ToolContent>
    </Tool>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-undefined */
