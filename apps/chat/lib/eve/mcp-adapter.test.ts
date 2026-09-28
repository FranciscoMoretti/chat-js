import { tool } from "ai";
import type { ToolExecutionOptions } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { describeMcpTool, executeMcpTool } from "./mcp-adapter";

describe("Eve tool contract", () => {
  it("removes executable schema metadata from the advertised JSON schema", async () => {
    const adapted = await describeMcpTool(
      tool({
        description: "Count words",
        execute: ({ text }) => text.length,
        inputSchema: z.object({ text: z.string() }),
      })
    );
    expect(adapted.inputSchema).toMatchObject({
      properties: { text: { type: "string" } },
      type: "object",
    });
    expect(JSON.stringify(adapted.inputSchema)).not.toContain("~standard");
  });
  it("refuses to silently bypass an existing approval policy", async () => {
    await expect(
      describeMcpTool(
        tool({
          description: "Protected",
          execute: () => "done",
          inputSchema: z.object({}),
          needsApproval: true,
        })
      )
    ).rejects.toThrow("explicit Eve policy");
  });

  it("executes a discovered MCP tool with its native invocation identity", async () => {
    const services = { selectedModel: "selected/model" };
    const definition = tool({
      description: "Inspect context",
      execute: (_input, options: ToolExecutionOptions<typeof services>) =>
        options.toolCallId,
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
