import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { AiGatewayModel } from "@chat-js/gateways/models";

import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";

import { GatewayRuntime } from "@chat-js/gateways/runtime";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";

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
  data: z.array(z.unknown()),
});

const deriveTags = (model: Readonly<OpenRouterModelResponse>): string[] => {
  const inputMods = (model.architecture ?? {}).input_modalities ?? ["text"];
  const outputMods = (model.architecture ?? {}).output_modalities ?? ["text"];
  const supportedParams = model.supported_parameters ?? [];

  const capabilities: readonly (readonly [boolean, string])[] = [
    [inputMods.includes("image"), "vision"],
    [inputMods.includes("file"), "file-input"],
    [outputMods.includes("image"), "image-generation"],
    [
      supportedParams.includes("reasoning") ||
        supportedParams.includes("include_reasoning"),
      "reasoning",
    ],
    [supportedParams.includes("tools"), "tool-use"],
  ];
  return capabilities.filter(([supported]) => supported).map(([, tag]) => tag);
};

const EMPTY_MODEL_COUNT = 0;
const UNKNOWN_MODEL_LIMIT = 0;
const UNKNOWN_MODEL_TIMESTAMP = 0;
const toAiGatewayModel = (
  model: Readonly<OpenRouterModelResponse>
): AiGatewayModel => {
  const tags = deriveTags(model);
  const outputMods = (model.architecture ?? {}).output_modalities ?? ["text"];

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
      (model.top_provider ?? {}).max_completion_tokens ?? UNKNOWN_MODEL_LIMIT,
    name: model.name ?? model.id,
    object: "model",
    owned_by,
    pricing: {
      image: (model.pricing ?? {}).image,
      input: (model.pricing ?? {}).prompt,
      input_cache_read: (model.pricing ?? {}).input_cache_read,
      input_cache_write: (model.pricing ?? {}).input_cache_write,
      output: (model.pricing ?? {}).completion,
      web_search: (model.pricing ?? {}).web_search,
    },
    tags: tags.length > EMPTY_TAG_COUNT ? tags : undefined,
    type,
  };
};

// Validate the wire envelope separately from each model so valid neighbors survive.
const parseProviderModels = (value: unknown): AiGatewayModel[] => {
  const body = providerModelListSchema.parse(value);
  const result = body.data.flatMap((entry): AiGatewayModel[] => {
    const model = providerModelSchema.safeParse(entry);
    if (!model.success) {
      return [];
    }
    return [toAiGatewayModel(model.data)];
  });
  // A genuinely empty catalog is valid; a nonempty unparseable catalog is not.
  if (
    body.data.length > EMPTY_MODEL_COUNT &&
    result.length === EMPTY_MODEL_COUNT
  ) {
    throw new Error("Provider catalog contains no valid models.");
  }
  return result;
};

class OpenRouterGateway
  extends GatewayRuntime
  implements GatewayProvider<"openrouter">
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

  // OpenRouter generates images through multimodal language models.
  public readonly createImageModel = null;

  public readonly createVideoModel = null;

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

      const result = parseProviderModels(await response.json());

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
export { OpenRouterGateway as Gateway, OpenRouterGateway };
