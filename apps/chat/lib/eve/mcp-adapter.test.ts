import { tool } from "ai";
import type { ToolExecutionOptions } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { describeMcpTool, executeMcpTool } from "./mcp-adapter";

/* oxlint-disable max-lines-per-function, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * max-lines-per-function (#510): describe("Eve tool contract") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): describe("Eve tool contract") accepts _input; options: ToolExecutionOptions<typeof services>; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): describe("Eve tool contract") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
  it("refuses to silently bypass an existing approval policy", async () => {
    await expect(
      describeMcpTool(
        tool({
          description: "Protected",
          execute: (): string => "done",
          inputSchema: z.object({}),
          // oxlint-disable-next-line typescript/no-deprecated -- #583: This test verifies compatibility with approval metadata on legacy tool definitions.
          needsApproval: true,
        })
      )
    ).rejects.toThrow("explicit Eve policy");
  });

  it("executes a discovered MCP tool with its native invocation identity", async () => {
    const services = { selectedModel: "selected/model" };
    const definition = tool({
      description: "Inspect context",
      execute: (
        _input,
        options: ToolExecutionOptions<typeof services>
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
/* oxlint-enable max-lines-per-function, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */
