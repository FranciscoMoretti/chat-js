import { createGateway, type gateway } from "@ai-sdk/gateway";
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
import {
  type AiGatewayModel,
  aiGatewayModelDiscriminatorSchema,
  aiGatewayModelSchema,
  aiGatewayModelsEnvelopeSchema,
  isAiGatewayModelType,
} from "@chat-js/gateways/models";
import type { StrictLiterals } from "@chat-js/gateways/provider-types";
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import type { ImageModel } from "ai";

type VercelImageModelId = Parameters<(typeof gateway)["imageModel"]>[0];
type VercelVideoModelId = Parameters<(typeof gateway)["videoModel"]>[0];
type VercelLanguageModelId = StrictLiterals<
  Parameters<(typeof gateway)["languageModel"]>[0]
>;

export class VercelGateway
  extends GatewayRuntime
  implements
    GatewayProvider<
      "vercel",
      VercelLanguageModelId,
      VercelImageModelId,
      VercelVideoModelId
    >
{
  readonly type = "vercel";

  createLanguageModel(modelId: VercelLanguageModelId): LanguageModelV4 {
    return this.getProvider()(modelId);
  }

  createImageModel(modelId: VercelImageModelId): ImageModel {
    return this.getProvider().imageModel(modelId);
  }

  createVideoModel(modelId: VercelVideoModelId): Experimental_VideoModelV4 {
    return this.getProvider().videoModel(modelId);
  }

  private provider?: ReturnType<typeof createGateway>;

  private getProvider() {
    this.provider ??= createGateway({ apiKey: this.env.AI_GATEWAY_API_KEY });
    return this.provider;
  }

  private getApiKey(): string | undefined {
    return this.env.AI_GATEWAY_API_KEY || this.env.VERCEL_OIDC_TOKEN;
  }

  private getModelsUrl(): string {
    return "https://ai-gateway.vercel.sh/v1/models";
  }

  async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      this.log.warn("No AI gateway API key found, using fallback models");
      return [...this.getFallbackModels(this.type)];
    }

    const url = this.getModelsUrl();
    this.log.debug({ url }, "Fetching models from Vercel AI Gateway");

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
          "Vercel AI Gateway returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const bodyRaw = await response.json();
      const body = aiGatewayModelsEnvelopeSchema.parse(bodyRaw);
      const unsupportedTypes = new Set<string>();
      const models: AiGatewayModel[] = [];

      for (const candidate of body.data) {
        const { type } = aiGatewayModelDiscriminatorSchema.parse(candidate);
        if (!isAiGatewayModelType(type)) {
          unsupportedTypes.add(type);
          continue;
        }
        const model = aiGatewayModelSchema.parse(candidate);
        models.push({ ...model, type });
      }

      if (unsupportedTypes.size > 0) {
        this.log.warn(
          {
            unsupportedTypes: [...unsupportedTypes],
            skippedModelCount: body.data.length - models.length,
            modelCount: body.data.length,
          },
          "Skipping models with unsupported types from Vercel AI Gateway"
        );
      }

      this.log.info(
        { modelCount: models.length },
        "Successfully fetched models from Vercel AI Gateway"
      );
      return models;
    } catch (error) {
      this.log.error(
        { err: error, url },
        "Error fetching models from Vercel AI Gateway, falling back to generated models"
      );
      return [...this.getFallbackModels(this.type)];
    }
  }
}

export { VercelGateway as Gateway };
