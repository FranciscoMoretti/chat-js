import { tool } from "ai";
import { defineTool } from "eve/tools";
import { expectTypeOf, test } from "vitest";
import { z } from "zod";

import { toolResultToModelOutput } from "./tool-model-output";
import { defineToolSet } from "./tool-types";
import type { NativeToolUI } from "./tool-types";
import { executeWithToolUsage } from "./tool-usage";

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * no-magic-numbers (#517): test("declared EVE generics preserve schema and output types across overloads") uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("declared EVE generics preserve schema and output types across overloads") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep test("declared EVE generics preserve schema and output types across overloads")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): test("declared EVE generics preserve schema and output types across overloads") accepts context; usage; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("declared EVE generics preserve schema and output types across overloads") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
    // oxlint-disable-next-line typescript/require-await -- This fixture exercises the async-generator overload and its inferred streamed output type.
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
    wrong: tool({ execute: (): number => 1, inputSchema: z.object({}) }),
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
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
