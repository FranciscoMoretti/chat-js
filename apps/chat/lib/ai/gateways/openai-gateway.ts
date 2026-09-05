import { createOpenAI } from "@ai-sdk/openai";
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { ImageModel } from "ai";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";
import type { AiGatewayModel } from "../ai-gateway-models-schemas";
import { getFallbackModels } from "./fallback-models";
import type { GatewayProvider } from "./gateway-provider";
import type {
  ExtractImageModelIdFromProvider,
  ExtractModelIdFromProvider,
  StrictLiterals,
} from "./provider-types";

const log = createModuleLogger("ai/gateways/openai");

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

function toAiGatewayModel(model: OpenAIModelResponse): AiGatewayModel {
  return {
    id: model.id,
    object: "model",
    created: model.created ?? 0,
    owned_by:
      (model.owned_by === "system" ? "openai" : model.owned_by) ?? "openai",
    name: model.id,
    description: "",
    context_window: 0,
    max_tokens: 0,
    type: "language",
    pricing: {},
  };
}

export class OpenAIGateway
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
    return env.OPENAI_API_KEY;
  }

  async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      log.warn("No OPENAI_API_KEY found, using fallback models");
      return [...getFallbackModels(this.type)];
    }

    const url = "https://api.openai.com/v1/models";
    log.debug({ url }, "Fetching models from OpenAI");

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 3600 },
      });

      if (!response.ok) {
        log.error(
          { status: response.status, statusText: response.statusText, url },
          "OpenAI returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const body = await response.json();
      const models = (body.data ?? []) as OpenAIModelResponse[];
      const result = models.map(toAiGatewayModel);

      log.info(
        { modelCount: result.length },
        "Successfully fetched models from OpenAI"
      );
      return result;
    } catch (error) {
      log.error(
        { err: error, url },
        "Error fetching models from OpenAI, falling back to generated models"
      );
      return [...getFallbackModels(this.type)];
    }
  }
}
