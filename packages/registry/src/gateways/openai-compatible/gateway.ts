import type { LanguageModelV4 } from "@ai-sdk/provider";

import type { AiGatewayModel } from "@chat-js/gateways/models";

import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";

import { GatewayRuntime } from "@chat-js/gateways/runtime";

import type { ImageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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

const EMPTY_MODEL_COUNT = 0;
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
  if (
    body.data.length > EMPTY_MODEL_COUNT &&
    result.length === EMPTY_MODEL_COUNT
  ) {
    throw new Error("Provider catalog contains no valid models.");
  }
  return result;
};

class OpenAICompatibleGateway
  extends GatewayRuntime
  implements GatewayProvider<"openai-compatible">
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

  public readonly createVideoModel = null;

  private getApiKey(): string | undefined {
    return this.env.OPENAI_COMPATIBLE_API_KEY;
  }

  private getBaseURL(): string | undefined {
    const baseURL = this.env.OPENAI_COMPATIBLE_BASE_URL;
    if (baseURL === undefined || baseURL === "") {
      return undefined;
    }
    return z.url().parse(baseURL);
  }

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
}
export { OpenAICompatibleGateway as Gateway, OpenAICompatibleGateway };
