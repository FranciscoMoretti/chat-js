"use client";

import React from "react";

import { McpToolResult } from "@/components/part/mcp-tool-result";
import { eveMcpResult } from "@/lib/eve/mcp-result";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";

export const EveMcpResult = ({
  part,
  defaultOpen,
}: {
  readonly part: Extract<
    ReadonlyEveMessagePart,
    { readonly type: "dynamic-tool" }
  >;
  readonly defaultOpen?: boolean;
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
        errorText:
          failed === true
            ? "MCP tool failed. Check the connector in settings and try again."
            : undefined,
        input: part.input,
        output: result?.success === true ? result.data.output : undefined,
        state: failed === true ? "output-error" : part.state,
        toolName: part.toolName,
      }}
    />
  );
};
