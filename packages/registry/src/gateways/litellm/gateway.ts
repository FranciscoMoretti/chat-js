import type { LanguageModelV4 } from "@ai-sdk/provider";

import type { AiGatewayModel } from "@chat-js/gateways/models";

import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";

import { GatewayRuntime } from "@chat-js/gateways/runtime";

import type { ImageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

const MODEL_DISCOVERY_TIMEOUT_MS = 10_000;
const TRAILING_SLASHES_REGEX = /\/+$/u;

const litellmModelSchema = z.object({
  created: z.number().optional(),
  id: z.string(),
  object: z.string().optional(),
  owned_by: z.string().optional(),
});
const litellmModelsResponseSchema = z.object({
  data: z.array(litellmModelSchema),
});

type LiteLLMModelResponse = z.infer<
  typeof litellmModelsResponseSchema
>["data"][number];

const getModelsUrl = (baseURL: string): string => {
  const normalizedBaseURL = baseURL.replace(TRAILING_SLASHES_REGEX, "");
  if (normalizedBaseURL.endsWith("/v1")) {
    return `${normalizedBaseURL}/models`;
  }
  return `${normalizedBaseURL}/v1/models`;
};

const UNKNOWN_MODEL_LIMIT = 0;
const toAiGatewayModel = (model: LiteLLMModelResponse): AiGatewayModel => ({
  context_window: UNKNOWN_MODEL_LIMIT,
  created: model.created ?? UNKNOWN_MODEL_LIMIT,
  description: "",
  id: model.id,
  max_tokens: UNKNOWN_MODEL_LIMIT,
  name: model.id,
  object: "model",
  owned_by: model.owned_by ?? "litellm",
  pricing: {},
  type: "language",
});

class LiteLLMGateway
  extends GatewayRuntime
  implements GatewayProvider<"litellm">
{
  public readonly type = "litellm" as const;

  private getProvider(): ReturnType<typeof createOpenAICompatible> {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();
    if (!(typeof baseURL === "string" && baseURL !== "")) {
      throw new Error("LITELLM_BASE_URL is not configured");
    }
    return createOpenAICompatible({
      apiKey,
      baseURL,
      name: "litellm",
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
    return this.env.LITELLM_API_KEY;
  }

  private getBaseURL(): string | undefined {
    const baseURL = this.env.LITELLM_BASE_URL;
    if (baseURL === undefined || baseURL === "") {
      return undefined;
    }
    return z.url().parse(baseURL);
  }

  public async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();

    if (!(typeof baseURL === "string" && baseURL !== "")) {
      this.log.warn("No LITELLM_BASE_URL found, using fallback models");
      return [...this.getFallbackModels(this.type)];
    }

    const url = getModelsUrl(baseURL);
    this.log.debug({ url }, "Fetching models from LiteLLM proxy");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (typeof apiKey === "string" && apiKey !== "") {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await this.fetch(url, {
        headers,
        signal: AbortSignal.timeout(MODEL_DISCOVERY_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.log.error(
          { status: response.status, statusText: response.statusText, url },
          "LiteLLM proxy returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const body = litellmModelsResponseSchema.parse(await response.json());
      const models = body.data;
      const result = models.map((model) => toAiGatewayModel(model));

      this.log.info(
        { modelCount: result.length },
        "Successfully fetched models from LiteLLM proxy"
      );
      return result;
    } catch (error) {
      this.log.error(
        { err: error, url },
        "Error fetching models from LiteLLM proxy, falling back to generated models"
      );
      return [...this.getFallbackModels(this.type)];
    }
  }
}
export { LiteLLMGateway as Gateway, LiteLLMGateway };
