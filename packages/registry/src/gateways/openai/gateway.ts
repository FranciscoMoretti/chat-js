import { createOpenAI } from "@ai-sdk/openai";
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
import type { AiGatewayModel } from "@chat-js/gateways/models";
import type {
  ExtractImageModelIdFromProvider,
  ExtractModelIdFromProvider,
  StrictLiterals,
} from "@chat-js/gateways/provider-types";
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import type { ImageModel } from "ai";

type OpenaiLanguageModelId = StrictLiterals<
  ExtractModelIdFromProvider<typeof createOpenAI>
>;
type OpenaiImageModelId = StrictLiterals<
  ExtractImageModelIdFromProvider<typeof createOpenAI>
>;

interface OpenAIModelResponse {
  created: number;
  id: string;
  object: string;
  owned_by: string;
}

const toAiGatewayModel = (model: OpenAIModelResponse): AiGatewayModel => ({
  context_window: 0,
  created: model.created ?? 0,
  description: "",
  id: model.id,
  max_tokens: 0,
  name: model.id,
  object: "model",
  owned_by:
    (model.owned_by === "system" ? "openai" : model.owned_by) ?? "openai",
  pricing: {},
  type: "language",
});

export class OpenAIGateway
  extends GatewayRuntime
  implements
    GatewayProvider<"openai", OpenaiLanguageModelId, OpenaiImageModelId, never>
{
  readonly type = "openai" as const;

  private getProvider() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    return createOpenAI({ apiKey });
  }

  createLanguageModel(modelId: OpenaiLanguageModelId): LanguageModelV4 {
    const provider = this.getProvider();
    return provider(modelId);
  }

  createImageModel(modelId: OpenaiImageModelId): ImageModel {
    const provider = this.getProvider();
    return provider.image(modelId);
  }

  createVideoModel(_modelId: never): Experimental_VideoModelV4 | null {
    return null;
  }

  private getApiKey(): string | undefined {
    return this.env.OPENAI_API_KEY;
  }

  async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
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

      const body = await response.json();
      const models = (body.data ?? []) as OpenAIModelResponse[];
      const result = models.map(toAiGatewayModel);

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

export { OpenAIGateway as Gateway };
