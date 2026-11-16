import type { ImageModel, LanguageModel } from "ai";
import type { AppModelId } from "@/lib/ai/app-model-id";
import type { Experimental_VideoModelV4 } from "@ai-sdk/provider";

interface ToolModelProvider {
  createImageModel: (modelId: string) => ImageModel;
  createLanguageModel: (modelId: string) => LanguageModel;
  createVideoModel: (modelId: string) => Experimental_VideoModelV4;
  getModelDefinition: (modelId: string) => Promise<{
    apiModelId: string;
    id: AppModelId;
    output: { image: boolean; video: boolean };
  }>;
}
export type { ToolModelProvider };
