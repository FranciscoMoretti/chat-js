import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
import type { AiGatewayModel } from "@chat-js/gateways/models";
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ImageModel } from "ai";

interface OpenRouterModelResponse {
  architecture: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  } | null;
  context_length: number | null;
  created: number;
  description: string;
  id: string;
  name: string;
  pricing: {
    prompt?: string;
    completion?: string;
    image?: string;
    web_search?: string;
    internal_reasoning?: string;
    input_cache_read?: string;
    input_cache_write?: string;
  } | null;
  supported_parameters?: string[] | null;
  top_provider: {
    context_length?: number | null;
    max_completion_tokens: number | null;
  } | null;
}

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const deriveTags = (model: OpenRouterModelResponse): string[] => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const toAiGatewayModel = (model: OpenRouterModelResponse): AiGatewayModel => {
  const tags = deriveTags(model);
  const outputMods = model.architecture?.output_modalities ?? ["text"];

  let type: "language" | "embedding" | "image" = "language";
  if (!outputMods.includes("text") && outputMods.includes("image")) {
    type = "image";
  }

  const owned_by = model.id.split("/")[0] ?? "unknown";

  return {
    context_window: model.context_length ?? 0,
    created: model.created ?? 0,
    description: model.description ?? "",
    id: model.id,
    max_tokens: model.top_provider?.max_completion_tokens ?? 0,
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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Retain the current provider-response compatibility contract; adding strict provider schemas would require deciding how unknown model fields and provider variants are handled.
    tags: tags.length > 0 ? (tags as AiGatewayModel["tags"]) : undefined,
    type,
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class OpenRouterGateway
  extends GatewayRuntime
  implements GatewayProvider<"openrouter", string, never, never>
{
  public readonly type = "openrouter" as const;

  private getProvider() {
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

  // The models endpoint is fixed by the provider contract.
  // eslint-disable-next-line class-methods-use-this -- Review debt #623: this provider URL helper is independent of instance state; review conversion to a static or module helper.
  private getModelsUrl(): string {
    return "https://openrouter.ai/api/v1/models";
  }

  public async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!(typeof apiKey === "string" && apiKey !== "")) {
      this.log.warn("No OPENROUTER_API_KEY found, using fallback models");
      return [...this.getFallbackModels(this.type)];
    }

    const url = this.getModelsUrl();
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

      // oxlint-disable-next-line typescript/no-unsafe-assignment -- Retain the current provider-response compatibility contract; adding strict provider schemas would require deciding how unknown model fields and provider variants are handled.
      const body = await response.json();
      // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- Retain the current provider-response compatibility contract; adding strict provider schemas would require deciding how unknown model fields and provider variants are handled.
      const models = (body.data ?? []) as OpenRouterModelResponse[];
      const result = models.map((model) => toAiGatewayModel(model));

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export { OpenRouterGateway as Gateway };
/* oxlint-enable import/group-exports */
