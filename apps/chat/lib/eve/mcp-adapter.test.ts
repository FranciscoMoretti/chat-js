import { tool } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  describeMcpTool,
  executeMcpTool,
} from "../../plugins/mcp/runtime/mcp-adapter";

describe("Eve tool contract", () => {
  it("removes executable schema metadata from the advertised JSON schema", async () => {
    const adapted = await describeMcpTool(
      tool({
        description: "Count words",
        execute: ({ text }): number => text.length,
        inputSchema: z.object({ text: z.string() }),
      })
    );
    expect(adapted.inputSchema).toMatchObject({
      properties: { text: { type: "string" } },
      type: "object",
    });
    expect(JSON.stringify(adapted.inputSchema)).not.toContain("~standard");
  });
  it("executes a discovered MCP tool with its native invocation identity", async () => {
    const definition = tool({
      description: "Inspect context",
      execute: (
        _input: Readonly<Record<string, never>>,
        options: { readonly toolCallId: string }
      ): string => options.toolCallId,
      inputSchema: z.object({}),
    });

    const output = await Array.fromAsync(
      executeMcpTool(
        definition,
        {},
        {
          abortSignal: new AbortController().signal,
          callId: "context-test",
        },
        []
      )
    );

    expect(output).toEqual(["context-test"]);
  });
});
