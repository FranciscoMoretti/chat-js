import { tool } from "ai";
import { defineTool } from "eve/tools";
import { expectTypeOf, test } from "vitest";
import { z } from "zod";

import { toolResultToModelOutput } from "./tool-model-output";
import { defineToolSet } from "./tool-types";
import type { NativeToolUI } from "./tool-types";
import { executeWithToolUsage } from "./tool-usage";

test("declared EVE generics preserve schema and output types across overloads", () => {
  const counted = defineTool({
    description: "Count",
    execute: ({ text }, context) =>
      executeWithToolUsage(context, (usage) => {
        usage.addCostUsd(0);
        return { length: text.length };
      }),
    inputSchema: z.object({ text: z.string() }),
    toModelOutput: toolResultToModelOutput,
  });
  const streamed = defineTool({
    description: "Stream",
    async *execute({ count }) {
      yield { count };
    },
    inputSchema: z.object({ count: z.number() }),
  });
  const declared = defineTool({
    description: "Explicit output schema",
    execute: () => ({ valid: true }),
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ valid: z.boolean() }),
  });
  const registry = defineToolSet({ counted, declared, streamed });
  expectTypeOf<NativeToolUI<typeof registry.counted>>().toEqualTypeOf<{
    input: { text: string };
    output: { length: number };
  }>();
  expectTypeOf<NativeToolUI<typeof registry.streamed>>().toEqualTypeOf<{
    input: { count: number };
    output: { count: number };
  }>();
  expectTypeOf<NativeToolUI<typeof registry.declared>>().toEqualTypeOf<{
    input: { id: string };
    output: { valid: boolean };
  }>();
  defineToolSet({
    // @ts-expect-error AI SDK tools do not satisfy the single native EVE contract.
    wrong: tool({ execute: () => 1, inputSchema: z.object({}) }),
  });
  defineToolSet({
    // @ts-expect-error Functions cannot cross the durable result boundary.
    wrong: defineTool({
      description: "Invalid",
      execute: () => () => 1,
      inputSchema: z.object({}),
    }),
  });
});
