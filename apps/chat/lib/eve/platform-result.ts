import { z } from "zod";

import {
  type ResearchUpdate,
  ResearchUpdateSchema,
} from "@/tools/platform/research-updates-schema";

/** Durable tool output and billing evidence travel together in Eve's action result. */
export const evePlatformOutput = z.object({
  kind: z.literal("chatjs.platform-result"),
  version: z.literal(1),
  output: z.json(),
  updates: z.array(ResearchUpdateSchema).optional(),
});

export const evePlatformResult = evePlatformOutput.extend({
  usage: z.object({ costUsd: z.number().finite().nonnegative().optional() }),
});

export function createEvePlatformResult(
  output: unknown,
  costUsd: number | undefined,
  updates?: ResearchUpdate[]
) {
  return evePlatformResult.parse({
    kind: "chatjs.platform-result",
    version: 1,
    output,
    updates,
    usage: { costUsd },
  });
}

export function isEvePlatformTool(name: string) {
  return (
    name === "deepResearch" ||
    name === "generateImage" ||
    name === "generateVideo" ||
    name === "codeExecution" ||
    name === "webSearch" ||
    name === "runCodeDocument"
  );
}
