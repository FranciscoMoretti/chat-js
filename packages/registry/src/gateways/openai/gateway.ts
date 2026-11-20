import type { LanguageModelV4 } from "@ai-sdk/provider";

import type { AiGatewayModel } from "@/chatjs/core/gateway/models";

import type { GatewayProvider } from "@/chatjs/core/gateway/gateway-provider";

import { GatewayRuntime } from "@/chatjs/core/gateway/runtime";

import type { ImageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const MODEL_ID_PARAMETER_INDEX = 0;
type OpenAiLanguageModelId = Parameters<
  ReturnType<typeof createOpenAI>["languageModel"]
>[typeof MODEL_ID_PARAMETER_INDEX];
type OpenAiImageModelId = Parameters<
  ReturnType<typeof createOpenAI>["image"]
>[typeof MODEL_ID_PARAMETER_INDEX];

const providerModelSchema = z.object({
  created: z.number().nullish(),
  id: z.string(),
  owned_by: z.string().nullish(),
});
type OpenAIModelResponse = z.output<typeof providerModelSchema>;
const providerModelListSchema = z.object({
  data: z.array(z.unknown()),
});

const EMPTY_MODEL_COUNT = 0;
const UNKNOWN_MODEL_LIMIT = 0;
const UNKNOWN_MODEL_TIMESTAMP = 0;
const toAiGatewayModel = (
  model: Readonly<OpenAIModelResponse>
): AiGatewayModel => ({
  context_window: UNKNOWN_MODEL_LIMIT,
  created: model.created ?? UNKNOWN_MODEL_TIMESTAMP,
  description: "",
  id: model.id,
  max_tokens: UNKNOWN_MODEL_LIMIT,
  name: model.id,
  object: "model",
  owned_by:
    (model.owned_by === "system" ? "openai" : model.owned_by) ?? "openai",
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

class OpenAIGateway
  extends GatewayRuntime
  implements GatewayProvider<"openai">
{
  public readonly type = "openai" as const;

  private getProvider(): ReturnType<typeof createOpenAI> {
    const apiKey = this.getApiKey();
    if (!(typeof apiKey === "string" && apiKey !== "")) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    return createOpenAI({ apiKey });
  }

  public createLanguageModel(modelId: OpenAiLanguageModelId): LanguageModelV4 {
    const provider = this.getProvider();
    return provider(modelId);
  }

  public createImageModel(modelId: OpenAiImageModelId): ImageModel {
    const provider = this.getProvider();
    return provider.image(modelId);
  }

  public readonly createVideoModel = null;

  private getApiKey(): string | undefined {
    return this.env.OPENAI_API_KEY;
  }

  public async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!(typeof apiKey === "string" && apiKey !== "")) {
      this.log.warn("No OPENAI_API_KEY found, using fallback models");
      return [...this.getFallbackModels(this.type)];
    }

    const url = "https://api.openai.com/v1/models";
    this.log.debug({ url }, "Fetching models from OpenAI");

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
          "OpenAI returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const result = parseProviderModels(await response.json());

      this.log.info(
        { modelCount: result.length },
        "Successfully fetched models from OpenAI"
      );
      return result;
    } catch (error) {
      this.log.error(
        { err: error, url },
        "Error fetching models from OpenAI, falling back to generated models"
      );
      return [...this.getFallbackModels(this.type)];
    }
  }
}
export { OpenAIGateway as Gateway, OpenAIGateway };
