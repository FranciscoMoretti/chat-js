import type { ToolContext } from "eve/tools";

import type { ResearchUpdate } from "../../tools/platform/research-updates-schema";
import type { ToolProgressWriter } from "../ai/tool-context";
import type { ToolOutput } from "./tool-result";
import { executeWithToolProgress } from "./tool-usage";
import type { ToolUsage } from "./tool-usage";

export const executeWithResearchProgress = <T extends ToolOutput>(
  context: Pick<ToolContext, "abortSignal">,
  execute: (options: {
    abortSignal: AbortSignal;
    usage: ToolUsage;
    dataStream: ToolProgressWriter;
  }) => Promise<T>
) =>
  executeWithToolProgress<T | { searches: [] }>(
    context,
    ({ abortSignal, usage, publish }) => {
      const updates = new Map<string, ResearchUpdate>();
      return execute({
        abortSignal,
        dataStream: {
          write(part) {
            updates.set(part.id ?? `update-${updates.size}`, part.data);
            publish({ searches: [] }, [...updates.values()]);
          },
        },
        usage,
      });
    }
  );
