import { z } from "zod";

import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

/** Durable tool output and billing evidence travel together in Eve's action result. */
export const evePlatformOutput = z.object({
  kind: z.literal("chatjs.platform-result"),
  output: z.json(),
  updates: z.array(ResearchUpdateSchema).optional(),
  version: z.literal(1),
});

export const evePlatformResult = evePlatformOutput.extend({
  usage: z.object({ costUsd: z.number().finite().nonnegative().optional() }),
});

export const createEvePlatformResult = (
  output: unknown,
  costUsd: number | undefined,
  updates?: ResearchUpdate[]
) =>
  evePlatformResult.parse({
    kind: "chatjs.platform-result",
    output,
    updates,
    usage: { costUsd },
    version: 1,
  });

export const isEvePlatformTool = (name: string) =>
  name === "deepResearch" ||
  name === "generateImage" ||
  name === "generateVideo" ||
  name === "codeExecution" ||
  name === "webSearch" ||
  name === "runCodeDocument";
