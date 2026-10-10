import { expect, expectTypeOf, test } from "bun:test";
import { describeMcpTool } from "./lib/eve/mcp-adapter";
import { tool } from "ai";
import { z } from "zod";

/* oxlint-disable oxc/no-async-await -- Await the native adapter result and preserve rejected-Promise assertions in this SDK contract test. */
test("describes an inline native tool with inferred numeric output", async (): Promise<void> => {
  const inputSchema = z.object({ text: z.string() });
  const adapted = await describeMcpTool(
    tool({
      description: "Count words",
      execute: ({ text }): number => {
        expectTypeOf(text).toEqualTypeOf<string>();
        return text.length;
      },
      inputSchema,
    })
  );
  expectTypeOf(adapted.description).toEqualTypeOf<string>();
  expect(adapted.inputSchema).toMatchObject({
    properties: { text: { type: "string" } },
    type: "object",
  });
  expect(JSON.stringify(adapted.inputSchema)).not.toContain("~standard");
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Await the adapter rejection before checking its native error and policy/schema observations. */
test("rejects native output policy before reading schema or invoking policy", async (): Promise<void> => {
  const observations: {
    policyCalls: number;
    policyReads: number;
    receiver?: unknown;
    schemaReads: number;
  } = { policyCalls: 0, policyReads: 0, schemaReads: 0 };
  const definition = tool({
    execute: ({ text }: Readonly<{ text: string }>): number => text.length,
    inputSchema: z.object({ text: z.string() }),
    toModelOutput: ({ output }: Readonly<{ output: number }>) => {
      expectTypeOf(output).toEqualTypeOf<number>();
      observations.policyCalls += 1;
      return { type: "text", value: String(output) };
    },
  });
  const policy = definition.toModelOutput;
  Object.defineProperties(definition, {
    inputSchema: {
      get(): never {
        observations.schemaReads += 1;
        throw new Error("Policy rejection must precede schema access");
      },
    },
    toModelOutput: {
      get(): typeof policy {
        observations.policyReads += 1;
        observations.receiver = this;
        return policy;
      },
    },
  });
  const failure = await describeMcpTool(definition).catch(
    (error: unknown): unknown => error
  );
  expect(failure).toBeInstanceOf(Error);
  expect(failure).toHaveProperty(
    "message",
    "This tool requires an explicit Eve policy adapter."
  );
  expect(observations).toEqual({
    policyCalls: 0,
    policyReads: 1,
    receiver: definition,
    schemaReads: 0,
  });
});
/* oxlint-enable oxc/no-async-await */
