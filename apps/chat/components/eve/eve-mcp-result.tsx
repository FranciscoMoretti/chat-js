"use client";

import type { EveMessagePart } from "eve/client";
import React from "react";

import { McpToolResult } from "@/components/part/mcp-tool-result";
import { eveMcpResult } from "@/lib/eve/mcp-result";

/* oxlint-disable no-undefined, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including failed). */

export const EveMcpResult = ({
  part,
  defaultOpen,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  defaultOpen?: boolean;
}): React.JSX.Element => {
  const result =
    part.state === "output-available"
      ? eveMcpResult.safeParse(part.output)
      : undefined;
  const failed = part.state === "output-error" || (result && !result.success);
  return (
    <McpToolResult
      defaultOpen={defaultOpen}
      part={{
        errorText: failed
          ? "MCP tool failed. Check the connector in settings and try again."
          : undefined,
        input: part.input,
        output: result?.success ? result.data.output : undefined,
        state: failed ? "output-error" : part.state,
        toolName: part.toolName,
      }}
    />
  );
};
/* oxlint-enable no-undefined, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
