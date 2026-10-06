"use client";

import type { EveMessagePart } from "eve/client";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { McpToolResult } from "@/components/part/mcp-tool-result";
/* oxlint-enable sort-imports */
import { eveMcpResult } from "@/lib/eve/mcp-result";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveMcpResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-undefined, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including failed). */

export const EveMcpResult = ({
  part,
  defaultOpen,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  defaultOpen?: boolean;
}): React.JSX.Element => {
  const result =
    // oxlint-disable-next-line no-ternary -- Keep result as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    part.state === "output-available"
      ? eveMcpResult.safeParse(part.output)
      : undefined;
  const failed = part.state === "output-error" || (result && !result.success);
  return (
    <McpToolResult
      defaultOpen={defaultOpen}
      part={{
        // oxlint-disable-next-line no-ternary -- Keep errorText as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        errorText: failed
          ? "MCP tool failed. Check the connector in settings and try again."
          : undefined,
        input: part.input,
        // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading success from result; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep output as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        output: result?.success ? result.data.output : undefined,
        // oxlint-disable-next-line no-ternary -- Keep state as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        state: failed ? "output-error" : part.state,
        toolName: part.toolName,
      }}
    />
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-undefined, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
