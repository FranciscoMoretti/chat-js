import type { ToolExecutionOptions } from "ai";
import { tool } from "ai";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { describe, expect, it } from "vitest";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { describeMcpTool, executeMcpTool } from "./mcp-adapter";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
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
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */
