import { tool } from "ai";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { describe, expect, it } from "vitest";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { describeMcpTool, executeMcpTool } from "./mcp-adapter";
/* oxlint-enable sort-imports */

/* oxlint-disable unicorn/max-nested-calls --
 * unicorn/max-nested-calls (#568): describe("Eve tool contract") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
describe("Eve tool contract", () => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable unicorn/max-nested-calls */
