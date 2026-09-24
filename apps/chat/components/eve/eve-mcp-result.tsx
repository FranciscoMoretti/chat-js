"use client";

import type { EveMessagePart } from "eve/client";

import { eveMcpResult } from "@/lib/eve/mcp-result";

import { McpToolResult } from "../part/mcp-tool-result";

export const EveMcpResult = ({
  part,
  defaultOpen,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  defaultOpen?: boolean;
}) => {
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
