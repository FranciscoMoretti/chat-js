import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { ImageModel } from "ai";
import { z } from "zod";
import { createModuleLogger } from "@/lib/logger";
import type { AiGatewayModel } from "../ai-gateway-models-schemas";
import { getFallbackModels } from "./fallback-models";
import type { GatewayProvider } from "./gateway-provider";

const log = createModuleLogger("ai/gateways/litellm");
const TRAILING_SLASHES_REGEX = /\/+$/;

const litellmModelsResponseSchema = z.object({
  data: z.array(
    z.object({
      created: z.number().optional(),
      id: z.string(),
      object: z.string().optional(),
      owned_by: z.string().optional(),
    })
  ),
});

type LiteLLMModelResponse = z.infer<
  typeof litellmModelsResponseSchema
>["data"][number];

function toAiGatewayModel(model: LiteLLMModelResponse): AiGatewayModel {
  return {
    id: model.id,
    object: "model",
    created: model.created ?? 0,
    owned_by: model.owned_by ?? "litellm",
    name: model.id,
    description: "",
    context_window: 0,
    max_tokens: 0,
    type: "language",
    pricing: {},
  };
}

export class LiteLLMGateway
  implements GatewayProvider<"litellm", string, string, never>
{
  readonly type = "litellm" as const;

  private getProvider() {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();
    if (!baseURL) {
      throw new Error("LITELLM_BASE_URL is not configured");
    }
    return createOpenAICompatible({
      name: "litellm",
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
    return process.env.LITELLM_API_KEY;
  }

  private getBaseURL(): string | undefined {
    return process.env.LITELLM_BASE_URL;
  }

  private getModelsUrl(baseURL: string): string {
    const normalizedBaseURL = baseURL.replace(TRAILING_SLASHES_REGEX, "");
    if (normalizedBaseURL.endsWith("/v1")) {
      return `${normalizedBaseURL}/models`;
    }
    return `${normalizedBaseURL}/v1/models`;
  }

  async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();

    if (!baseURL) {
      log.warn("No LITELLM_BASE_URL found, using fallback models");
      return [...getFallbackModels(this.type)];
    }

    const url = this.getModelsUrl(baseURL);
    log.debug({ url }, "Fetching models from LiteLLM proxy");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 3600 },
      });

      if (!response.ok) {
        log.error(
          { status: response.status, statusText: response.statusText, url },
          "LiteLLM proxy returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const body = litellmModelsResponseSchema.parse(await response.json());
      const models = body.data;
      const result = models.map(toAiGatewayModel);

      log.info(
        { modelCount: result.length },
        "Successfully fetched models from LiteLLM proxy"
      );
      return result;
    } catch (error) {
      log.error(
        { err: error, url },
        "Error fetching models from LiteLLM proxy, falling back to generated models"
      );
      return [...getFallbackModels(this.type)];
    }
  }
}
