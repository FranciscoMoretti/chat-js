import type { Experimental_VideoModelV4 } from "@ai-sdk/provider";
import type { ImageModel, LanguageModel } from "ai";

import type { AppModelId } from "@/lib/ai/app-model-id";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): ToolProgressWriter accepts part: { data: ResearchUpdate; id?: string; type: "data-researchUpdate"; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Progress events understood by installed search tools without depending on ChatMessage. */
interface ToolProgressWriter {
  write: (part: {
    data: ResearchUpdate;
    id?: string;
    type: "data-researchUpdate";
  }) => void;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

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
export type { ToolModelProvider, ToolProgressWriter };
