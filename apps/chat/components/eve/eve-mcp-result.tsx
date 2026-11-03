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
  let errorText: string | undefined;
  if (part.state === "cancelled") {
    errorText = "MCP tool stopped.";
  } else if (failed === true) {
    errorText =
      "MCP tool failed. Check the connector in settings and try again.";
  }
  return (
    <McpToolResult
      defaultOpen={defaultOpen}
      part={{
        errorText,
        input: part.input,
        output: result?.success === true ? result.data.output : undefined,
        state: failed === true ? "output-error" : eveToolUIState(part.state),
        toolName: part.name,
      }}
    />
  );
};
