import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
/* oxlint-enable sort-imports */
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AiGatewayModel } from "@chat-js/gateways/models";
/* oxlint-enable sort-imports */
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import type { ImageModel } from "ai";
import { z } from "zod";

const providerModelSchema = z.object({
  created: z.number().nullish(),
  id: z.string(),
  owned_by: z.string().nullish(),
});
type OpenAICompatibleModelResponse = z.output<typeof providerModelSchema>;
const providerModelListSchema = z.object({
  data: z.array(z.unknown()),
});

const UNKNOWN_MODEL_LIMIT = 0;
const UNKNOWN_MODEL_TIMESTAMP = 0;
const toAiGatewayModel = (
  model: Readonly<OpenAICompatibleModelResponse>
): AiGatewayModel => ({
  context_window: UNKNOWN_MODEL_LIMIT,
  created: model.created ?? UNKNOWN_MODEL_TIMESTAMP,
  description: "",
  id: model.id,
  max_tokens: UNKNOWN_MODEL_LIMIT,
  name: model.id,
  object: "model",
  owned_by: model.owned_by ?? "unknown",
  pricing: {},
  type: "language",
});

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
class OpenAICompatibleGateway
  extends GatewayRuntime
  implements GatewayProvider<"openai-compatible", string, string, never>
{
  public readonly type = "openai-compatible" as const;

  private getProvider(): ReturnType<typeof createOpenAICompatible> {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();
    if (!(typeof baseURL === "string" && baseURL !== "")) {
      throw new Error("OPENAI_COMPATIBLE_BASE_URL is not configured");
    }
    return createOpenAICompatible({
      apiKey,
      baseURL,
      name: "openai-compatible",
    });
  }

  public createLanguageModel(modelId: string): LanguageModelV4 {
    const provider = this.getProvider();
    return provider(modelId);
  }

  public createImageModel(modelId: string): ImageModel {
    const provider = this.getProvider();
    return provider.imageModel(modelId);
  }

  // The gateway interface requires a video factory even when unsupported.
  // eslint-disable-next-line class-methods-use-this -- GatewayProvider requires this instance slot; unsupported video is represented by null, so this factory must remain callable on provider instances.
  public createVideoModel(_modelId: never): Experimental_VideoModelV4 | null {
    return null;
  }

  private getApiKey(): string | undefined {
    return this.env.OPENAI_COMPATIBLE_API_KEY;
  }

  private getBaseURL(): string | undefined {
    return this.env.OPENAI_COMPATIBLE_BASE_URL;
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchModels's awaited sequencing and rejected-Promise behavior. */
  public async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();

    if (!(typeof baseURL === "string" && baseURL !== "")) {
      this.log.warn(
        "No OPENAI_COMPATIBLE_BASE_URL found, using fallback models"
      );
      return [...this.getFallbackModels(this.type)];
    }

    const url = `${baseURL}/models`;
    this.log.debug({ url }, "Fetching models from OpenAI-compatible provider");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (typeof apiKey === "string" && apiKey !== "") {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await this.fetch(url, {
        headers,
      });

      if (!response.ok) {
        this.log.error(
          { status: response.status, statusText: response.statusText, url },
          "OpenAI-compatible provider returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const result = parseProviderModels(await response.json());

      this.log.info(
        { modelCount: result.length },
        "Successfully fetched models from OpenAI-compatible provider"
      );
      return result;
    } catch (error) {
      this.log.error(
        { err: error, url },
        "Error fetching models from OpenAI-compatible provider, falling back to generated models"
      );
      return [...this.getFallbackModels(this.type)];
    }
  }
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Gateway, OpenAICompatibleGateway); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */
export { OpenAICompatibleGateway as Gateway, OpenAICompatibleGateway };
/* oxlint-enable import/no-named-export */
