import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AiGatewayModel } from "@chat-js/gateways/models";
/* oxlint-enable sort-imports */
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ImageModel } from "ai";
/* oxlint-enable sort-imports */
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

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
const deriveTags = (model: Readonly<OpenRouterModelResponse>): string[] => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading input_modalities from model.architecture; preserve one receiver evaluation, skipped accesses and the existing ["text"] fallback.
  const inputMods = model.architecture?.input_modalities ?? ["text"];
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading output_modalities from model.architecture; preserve one receiver evaluation, skipped accesses and the existing ["text"] fallback.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading output_modalities from model.architecture; preserve one receiver evaluation, skipped accesses and the existing ["text"] fallback.
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading max_completion_tokens from model.top_provider; preserve one receiver evaluation, skipped accesses and the existing UNKNOWN_MODEL_LIMIT fallback.
      model.top_provider?.max_completion_tokens ?? UNKNOWN_MODEL_LIMIT,
    name: model.name ?? model.id,
    object: "model",
    owned_by,
    pricing: {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading image from model.pricing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      image: model.pricing?.image,
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading prompt from model.pricing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      input: model.pricing?.prompt,
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading input_cache_read from model.pricing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      input_cache_read: model.pricing?.input_cache_read,
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading input_cache_write from model.pricing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      input_cache_write: model.pricing?.input_cache_write,
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading completion from model.pricing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      output: model.pricing?.completion,
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading web_search from model.pricing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      web_search: model.pricing?.web_search,
    },
    // oxlint-disable-next-line eslint/no-undefined, no-ternary -- Preserve the gateway result's own tags key when no tags apply; omitting the key changes Object.hasOwn and object spread behavior.; no-ternary: Keep tags as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
  // oxlint-disable-next-line no-magic-numbers -- Zero is the empty-array cardinality for the catalog validation boundary.
  if (body.data.length > 0 && result.length === 0) {
    throw new Error("Provider catalog contains no valid models.");
  }
  return result;
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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchModels's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Gateway, OpenRouterGateway); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */
export { OpenRouterGateway as Gateway, OpenRouterGateway };
/* oxlint-enable import/no-named-export */
