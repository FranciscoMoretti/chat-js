import { z } from "zod";

/** Durable tool output and billing evidence travel together in Eve's action result. */
export const evePlatformOutput = z.object({
  kind: z.literal("chatjs.platform-result"),
  version: z.literal(1),
  output: z.json(),
});

export const evePlatformResult = evePlatformOutput.extend({
  usage: z.object({ costUsd: z.number().finite().nonnegative() }),
});

export function createEvePlatformResult(output: unknown, costUsd: number) {
  return evePlatformResult.parse({
    kind: "chatjs.platform-result",
    version: 1,
    output,
    usage: { costUsd },
  });
}
