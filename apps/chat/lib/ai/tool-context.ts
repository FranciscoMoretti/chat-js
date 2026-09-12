import type { CostAccumulator } from "@/lib/credits/cost-accumulator";

import type { StreamWriter } from "./types";

/** Optional per-request services passed through AI SDK toolsContext. */
export interface ChatToolContext {
  costAccumulator?: CostAccumulator;
  dataStream?: StreamWriter;
  toolCallIdOverride?: string;
  writeTopLevelUpdates?: boolean;
}
