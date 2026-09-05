import { gateway } from "@ai-sdk/gateway";
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { ImageModel } from "ai";
import { createModuleLogger } from "@/lib/logger";
import {
  type AiGatewayModel,
  aiGatewayModelDiscriminatorSchema,
  aiGatewayModelSchema,
  aiGatewayModelsEnvelopeSchema,
  isAiGatewayModelType,
} from "../ai-gateway-models-schemas";
import { getFallbackModels } from "./fallback-models";
import type { GatewayProvider } from "./gateway-provider";
import type { StrictLiterals } from "./provider-types";

const log = createModuleLogger("ai/gateways/vercel");

type VercelImageModelId = Parameters<(typeof gateway)["imageModel"]>[0];
type VercelVideoModelId = Parameters<(typeof gateway)["videoModel"]>[0];
type VercelLanguageModelId = StrictLiterals<
  Parameters<(typeof gateway)["languageModel"]>[0]
>;

export class VercelGateway
  implements
    GatewayProvider<
      "vercel",
      VercelLanguageModelId,
      VercelImageModelId,
      VercelVideoModelId
    >
{
  readonly type = "vercel" as const;

  createLanguageModel(modelId: VercelLanguageModelId): LanguageModelV4 {
    return gateway(modelId);
  }

  createImageModel(modelId: VercelImageModelId): ImageModel {
    return gateway.imageModel(modelId);
  }

  createVideoModel(modelId: VercelVideoModelId): Experimental_VideoModelV4 {
    return gateway.videoModel(modelId);
  }

  private getApiKey(): string | undefined {
    return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  }

  private getModelsUrl(): string {
    return "https://ai-gateway.vercel.sh/v1/models";
  }

  async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      log.warn("No AI gateway API key found, using fallback models");
      return [...getFallbackModels(this.type)];
    }

    const url = this.getModelsUrl();
    log.debug({ url }, "Fetching models from Vercel AI Gateway");

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
        log.warn(
          {
            unsupportedTypes: [...unsupportedTypes],
            skippedModelCount: body.data.length - models.length,
            modelCount: body.data.length,
          },
          "Skipping models with unsupported types from Vercel AI Gateway"
        );
      }

      log.info(
        { modelCount: models.length },
        "Successfully fetched models from Vercel AI Gateway"
      );
      return models;
    } catch (error) {
      log.error(
        { err: error, url },
        "Error fetching models from Vercel AI Gateway, falling back to generated models"
      );
      return [...getFallbackModels(this.type)];
    }
  }
}
