import type { FileUIPart } from "ai";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { StreamWriter } from "./types";

/** Optional per-request services passed through AI SDK toolsContext. */
export interface ChatToolContext {
  attachments?: FileUIPart[];
  costAccumulator?: CostAccumulator;
  dataStream?: StreamWriter;
  lastGeneratedImage?: { imageUrl: string; name: string } | null;
  selectedModel?: string;
  toolCallIdOverride?: string;
  writeTopLevelUpdates?: boolean;
}
