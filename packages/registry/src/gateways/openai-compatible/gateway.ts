import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { ImageModel } from "ai";
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
import type { AiGatewayModel } from "@chat-js/gateways/models";
import { GatewayRuntime } from "@chat-js/gateways/runtime";

interface OpenAICompatibleModelResponse {
  created: number;
  id: string;
  object: string;
  owned_by: string;
}

function toAiGatewayModel(
  model: OpenAICompatibleModelResponse
): AiGatewayModel {
  return {
    id: model.id,
    object: "model",
    created: model.created ?? 0,
    owned_by: model.owned_by ?? "unknown",
    name: model.id,
    description: "",
    context_window: 0,
    max_tokens: 0,
    type: "language",
    pricing: {},
  };
}

export class OpenAICompatibleGateway
  extends GatewayRuntime
  implements GatewayProvider<"openai-compatible", string, string, never>
{
  readonly type = "openai-compatible" as const;

  private getProvider() {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();
    if (!baseURL) {
      throw new Error("OPENAI_COMPATIBLE_BASE_URL is not configured");
    }
    return createOpenAICompatible({
      name: "openai-compatible",
      baseURL,
      apiKey,
    });
  }

  createLanguageModel(modelId: string): LanguageModelV4 {
    const provider = this.getProvider();
    return provider(modelId);
  }

  createImageModel(modelId: string): ImageModel {
    const provider = this.getProvider();
    return provider.imageModel(modelId);
  }

  createVideoModel(_modelId: never): Experimental_VideoModelV4 | null {
    return null;
  }

  private getApiKey(): string | undefined {
    return this.env.OPENAI_COMPATIBLE_API_KEY;
  }

  private getBaseURL(): string | undefined {
    return this.env.OPENAI_COMPATIBLE_BASE_URL;
  }

  async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();

    if (!baseURL) {
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
      if (apiKey) {
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

      const body = await response.json();
      const models = (body.data ?? []) as OpenAICompatibleModelResponse[];
      const result = models.map(toAiGatewayModel);

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

export { OpenAICompatibleGateway as Gateway };
