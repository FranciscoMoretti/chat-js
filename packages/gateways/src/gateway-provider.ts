import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { ImageModel } from "ai";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { AiGatewayModel } from "./models.ts";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export interface GatewayProvider<
  TGateway extends string = string,
  TModelId extends string = string,
  TImageModelId extends string = string,
  TVideoModelId extends string = string,
> {
  /** Create a dedicated image model instance, or null if unsupported */
  createImageModel: (modelId: TImageModelId) => ImageModel | null;

  /** Create a language model instance from a model ID like "openai/gpt-5-nano" */
  createLanguageModel: (modelId: TModelId) => LanguageModelV4;

  /** Create a video model instance, or null if unsupported */
  createVideoModel: (
    modelId: TVideoModelId
  ) => Experimental_VideoModelV4 | null;

  /** Fetch the list of available models from the gateway's API */
  fetchModels: () => Promise<AiGatewayModel[]>;
  readonly type: TGateway;
}
/* oxlint-enable import/no-named-export */
