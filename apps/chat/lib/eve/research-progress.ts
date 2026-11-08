import type { z } from "zod";
import type { ToolContext } from "eve/tools";

import type { ToolProgressWriter } from "@/lib/ai/tool-context";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

import type { ToolOutput, ToolResult } from "./tool-result";
import type { ToolUsage } from "./tool-usage";
import { executeWithToolProgress } from "./tool-usage";

export const executeWithResearchProgress = <Output extends ToolOutput>(
  context: ReadonlyNativeSurface<Pick<ToolContext, "abortSignal">>,
  execute: (
    options: ReadonlyNativeSurface<{
      abortSignal: AbortSignal;
      usage: ToolUsage;
      dataStream: ToolProgressWriter;
    }>
  ) => Promise<NoInfer<Output>>,
  outputSchema: z.ZodType<Output>
): AsyncGenerator<ToolResult<Output>, void> =>
  executeWithToolProgress<Output>(
    context,
    async ({ abortSignal, usage, publish }) => {
      const updates = new Map<string, ReadonlyNativeSurface<ResearchUpdate>>();
      return outputSchema.parse(
        await execute({
          abortSignal,
          dataStream: {
            write(part): void {
              updates.set(part.id ?? `update-${updates.size}`, part.data);
              publish(outputSchema.parse({ searches: [] }), [
                ...updates.values(),
              ]);
            },
          },
          usage,
        })
      );
    }
  );
