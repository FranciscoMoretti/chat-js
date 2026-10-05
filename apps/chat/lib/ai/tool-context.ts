import type { Experimental_VideoModelV4 } from "@ai-sdk/provider";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ImageModel, LanguageModel } from "ai";
/* oxlint-enable sort-imports */

import type { AppModelId } from "@/lib/ai/app-model-id";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

/** Progress events understood by installed search tools without depending on ChatMessage. */
interface ToolProgressWriter {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Writer implementations receive ResearchUpdate with mutable query/results arrays; making the callback accept readonly arrays would break assignability of existing publishing consumers.
  write: (part: {
    data: ResearchUpdate;
    id?: string;
    type: "data-researchUpdate";
  }) => void;
}

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
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ToolModelProvider, ToolProgressWriter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ToolModelProvider, ToolProgressWriter };
/* oxlint-enable import/no-named-export */
