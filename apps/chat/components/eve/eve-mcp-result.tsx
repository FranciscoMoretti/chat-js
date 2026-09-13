"use client";

import type { EveMessagePart } from "eve/client";

import { eveMcpResult } from "@/lib/eve/mcp-result";

import { McpToolResult } from "../part/mcp-tool-result";

export function EveMcpResult({
  part,
  defaultOpen,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  defaultOpen?: boolean;
}) {
  const result =
    part.state === "output-available"
      ? eveMcpResult.safeParse(part.output)
      : undefined;
  const failed = part.state === "output-error" || (result && !result.success);
  return (
    <McpToolResult
      defaultOpen={defaultOpen}
      part={{
        toolName: part.toolName,
        input: part.input,
        state: failed ? "output-error" : part.state,
        output: result?.success ? result.data.output : undefined,
        errorText: failed
          ? "MCP tool failed. Check the connector in settings and try again."
          : undefined,
      }}
    />
  );
}
