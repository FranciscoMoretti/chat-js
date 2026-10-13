import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { AiGatewayModel } from "./models.ts";
import type { ImageModel } from "ai";

interface GatewayProvider<TGateway extends string = string> {
  /** Dedicated image model factory; null when this capability is unsupported. */
  createImageModel: ((modelId: string) => ImageModel) | null;

  /** Create a language model instance from a model ID like "openai/gpt-5-nano" */
  createLanguageModel: (modelId: string) => LanguageModelV4;

  /** Video model factory; null when this capability is unsupported. */
  createVideoModel: ((modelId: string) => Experimental_VideoModelV4) | null;

  /** Fetch the list of available models from the gateway's API */
  fetchModels: () => Promise<AiGatewayModel[]>;
  readonly type: TGateway;
}

export type { GatewayProvider };
