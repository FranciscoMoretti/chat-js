import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
import type { AiGatewayModel } from "@chat-js/gateways/models";
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ImageModel } from "ai";
import { z } from "zod";

const MODEL_OWNER_SEGMENT_INDEX = 0;
const EMPTY_TAG_COUNT = 0;
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

const modalitiesSchema = z.array(z.string()).nullish();
const providerModelSchema = z.object({
  architecture: z
    .object({
      input_modalities: modalitiesSchema,
      output_modalities: modalitiesSchema,
    })
    .nullish(),
  context_length: z.number().nullish(),
  created: z.number().nullish(),
  description: z.string().nullish(),
  id: z.string(),
  name: z.string().nullish(),
  pricing: z
    .object({
      completion: z.string().optional(),
      image: z.string().optional(),
      input_cache_read: z.string().optional(),
      input_cache_write: z.string().optional(),
      prompt: z.string().optional(),
      web_search: z.string().optional(),
    })
    .nullish(),
  supported_parameters: z.array(z.string()).nullish(),
  top_provider: z
    .object({ max_completion_tokens: z.number().nullish() })
    .nullish(),
});
type OpenRouterModelResponse = Omit<
  z.output<typeof providerModelSchema>,
  "architecture" | "pricing" | "top_provider" | "supported_parameters"
> & {
  architecture?: {
    readonly input_modalities?: readonly string[] | null;
    readonly output_modalities?: readonly string[] | null;
  } | null;
  pricing?: Readonly<z.output<typeof providerModelSchema>["pricing"]>;
  top_provider?: Readonly<z.output<typeof providerModelSchema>["top_provider"]>;
  supported_parameters?: readonly string[] | null;
};
const providerModelListSchema = z.object({
  data: z.array(providerModelSchema).nullish(),
});

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
const deriveTags = (model: Readonly<OpenRouterModelResponse>): string[] => {
  const inputMods = model.architecture?.input_modalities ?? ["text"];
  const outputMods = model.architecture?.output_modalities ?? ["text"];
  const supportedParams = model.supported_parameters ?? [];

  const tags: string[] = [];
  if (inputMods.includes("image")) {
    tags.push("vision");
  }
  if (inputMods.includes("file")) {
    tags.push("file-input");
  }
  if (outputMods.includes("image")) {
    tags.push("image-generation");
  }
  if (
    supportedParams.includes("reasoning") ||
    supportedParams.includes("include_reasoning")
  ) {
    tags.push("reasoning");
  }
  if (supportedParams.includes("tools")) {
    tags.push("tool-use");
  }
  return tags;
};
/* oxlint-enable eslint/max-statements */

const UNKNOWN_MODEL_LIMIT = 0;
const UNKNOWN_MODEL_TIMESTAMP = 0;
const toAiGatewayModel = (
  model: Readonly<OpenRouterModelResponse>
): AiGatewayModel => {
  const tags = deriveTags(model);
  const outputMods = model.architecture?.output_modalities ?? ["text"];

  let type: "language" | "embedding" | "image" = "language";
  if (!outputMods.includes("text") && outputMods.includes("image")) {
    type = "image";
  }

  const owned_by =
    model.id.split("/").at(MODEL_OWNER_SEGMENT_INDEX) ?? "unknown";

  return {
    context_window: model.context_length ?? UNKNOWN_MODEL_LIMIT,
    created: model.created ?? UNKNOWN_MODEL_TIMESTAMP,
    description: model.description ?? "",
    id: model.id,
    max_tokens:
      model.top_provider?.max_completion_tokens ?? UNKNOWN_MODEL_LIMIT,
    name: model.name ?? model.id,
    object: "model",
    owned_by,
    pricing: {
      image: model.pricing?.image,
      input: model.pricing?.prompt,
      input_cache_read: model.pricing?.input_cache_read,
      input_cache_write: model.pricing?.input_cache_write,
      output: model.pricing?.completion,
      web_search: model.pricing?.web_search,
    },
    // oxlint-disable-next-line eslint/no-undefined -- Preserve the gateway result's own tags key when no tags apply; omitting the key changes Object.hasOwn and object spread behavior.
    tags: tags.length > EMPTY_TAG_COUNT ? tags : undefined,
    type,
  };
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
class OpenRouterGateway
  extends GatewayRuntime
  implements GatewayProvider<"openrouter", string, never, never>
{
  public readonly type = "openrouter" as const;

  private getProvider(): ReturnType<typeof createOpenRouter> {
    const apiKey = this.getApiKey();
    if (!(typeof apiKey === "string" && apiKey !== "")) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }
    return createOpenRouter({ apiKey });
  }

  public createLanguageModel(modelId: string): LanguageModelV4 {
    const provider = this.getProvider();
    return provider.chat(modelId);
  }

  // The gateway interface requires an image factory even when unsupported.
  // eslint-disable-next-line class-methods-use-this -- GatewayProvider requires this instance factory even when the provider does not support this model type.
  public createImageModel(_modelId: never): ImageModel | null {
    // OpenRouter routes image generation through multimodal language models.
    // Return null to signal callers should use createLanguageModel instead.
    return null;
  }

  // The gateway interface requires a video factory even when unsupported.
  // eslint-disable-next-line class-methods-use-this -- GatewayProvider requires this instance factory even when the provider does not support this model type.
  public createVideoModel(_modelId: never): Experimental_VideoModelV4 | null {
    return null;
  }

  private getApiKey(): string | undefined {
    return this.env.OPENROUTER_API_KEY;
  }

  public async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!(typeof apiKey === "string" && apiKey !== "")) {
      this.log.warn("No OPENROUTER_API_KEY found, using fallback models");
      return [...this.getFallbackModels(this.type)];
    }

    const url = OPENROUTER_MODELS_URL;
    this.log.debug({ url }, "Fetching models from OpenRouter");

    try {
      const response = await this.fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        this.log.error(
          { status: response.status, statusText: response.statusText, url },
          "OpenRouter returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const body = providerModelListSchema.parse(await response.json());
      const models = body.data ?? [];
      const result = models.map((model: Readonly<OpenRouterModelResponse>) =>
        toAiGatewayModel(model)
      );

      this.log.info(
        { modelCount: result.length },
        "Successfully fetched models from OpenRouter"
      );
      return result;
    } catch (error) {
      this.log.error(
        { err: error, url },
        "Error fetching models from OpenRouter, falling back to generated models"
      );
      return [...this.getFallbackModels(this.type)];
    }
  }
}
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */
export { OpenRouterGateway as Gateway, OpenRouterGateway };
