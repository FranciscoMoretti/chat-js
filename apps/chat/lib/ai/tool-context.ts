import type { Experimental_VideoModelV4 } from "@ai-sdk/provider";
import type { FileUIPart, ImageModel, LanguageModel } from "ai";

import type { AppModelId } from "@/lib/ai/app-model-id";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { FileUploader } from "@/lib/file-storage";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

type ToolCostAccumulator = Pick<
  CostAccumulator,
  "addAPICost" | "addImageCost" | "addLLMCost"
>;

/** Progress events understood by installed search tools without depending on ChatMessage. */
export interface ToolProgressWriter {
  write: (part: {
    data: ResearchUpdate;
    id?: string;
    type: "data-researchUpdate";
  }) => void;
}

export interface ToolModelProvider {
  createImageModel: (modelId: string) => ImageModel;
  createLanguageModel: (modelId: string) => LanguageModel;
  createVideoModel: (modelId: string) => Experimental_VideoModelV4;
  getModelDefinition: (modelId: string) => Promise<{
    apiModelId: string;
    id: AppModelId;
    output: { image: boolean; video: boolean };
  }>;
}

/** Optional per-request services passed through AI SDK toolsContext. */
export interface ChatToolContext {
  attachments?: FileUIPart[];
  costAccumulator?: ToolCostAccumulator;
  dataStream?: ToolProgressWriter;
  lastGeneratedImage?: { imageUrl: string; name: string } | null;
  modelProvider?: ToolModelProvider;
  sandboxOwnership?: {
    created: (name: string) => Promise<void>;
    release: () => Promise<void>;
    reserve: (
      provider: { projectId: string; teamId: string },
      signal?: AbortSignal
    ) => Promise<string>;
  };
  selectedModel?: string;
  storeFile?: FileUploader;
  toolCallIdOverride?: string;
  writeTopLevelUpdates?: boolean;
}
