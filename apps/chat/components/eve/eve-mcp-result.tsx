"use client";
import { eveToolUIState } from "@/lib/eve/tool-ui-state";

import React from "react";

import { McpToolResult } from "@/components/part/mcp-tool-result";
import { eveMcpResult } from "@/lib/eve/mcp-result";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";

export const EveMcpResult = ({
  part,
  defaultOpen,
}: {
  readonly part: Extract<ReadonlyEveMessagePart, { readonly type: "tool" }>;
  readonly defaultOpen?: boolean;
}): React.JSX.Element => {
  const result =
    part.state === "completed"
      ? eveMcpResult.safeParse(part.output)
      : undefined;
  const failed = part.state === "failed" || (result && !result.success);
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
        state: failed === true ? "output-error" : eveToolUIState(part.state),
        toolName: part.name,
      }}
    />
  );
};
