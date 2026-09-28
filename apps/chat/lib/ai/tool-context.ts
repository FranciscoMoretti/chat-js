import type { Experimental_VideoModelV4 } from "@ai-sdk/provider";
import type { ImageModel, LanguageModel } from "ai";

import type { AppModelId } from "@/lib/ai/app-model-id";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

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
