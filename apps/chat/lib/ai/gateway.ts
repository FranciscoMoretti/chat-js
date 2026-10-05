import { createGateway } from "@ai-sdk/gateway";
import type { gateway } from "@ai-sdk/gateway";
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
import {
  aiGatewayModelDiscriminatorSchema,
  aiGatewayModelSchema,
  aiGatewayModelsEnvelopeSchema,
  isAiGatewayModelType,
} from "@chat-js/gateways/models";
import type { AiGatewayModel } from "@chat-js/gateways/models";
import type { StrictLiterals } from "@chat-js/gateways/provider-types";
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import type { ImageModel } from "ai";

const MODEL_ID_PARAMETER_INDEX = 0;
type VercelImageModelId = Parameters<
  (typeof gateway)["imageModel"]
>[typeof MODEL_ID_PARAMETER_INDEX];
type VercelVideoModelId = Parameters<
  (typeof gateway)["videoModel"]
>[typeof MODEL_ID_PARAMETER_INDEX];
type VercelLanguageModelId = StrictLiterals<
  Parameters<(typeof gateway)["languageModel"]>[typeof MODEL_ID_PARAMETER_INDEX]
>;

const EMPTY_MODEL_TYPE_COUNT = 0;

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
class VercelGateway
  extends GatewayRuntime
  implements
    GatewayProvider<
      "vercel",
      VercelLanguageModelId,
      VercelImageModelId,
      VercelVideoModelId
    >
{
  public readonly type = "vercel" as const;

  public createLanguageModel(modelId: VercelLanguageModelId): LanguageModelV4 {
    return this.getProvider()(modelId);
  }

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the SDK model-ID literal suggestions and open string intersection; this primitive input cannot be mutated.
  public createImageModel(modelId: VercelImageModelId): ImageModel {
    return this.getProvider().imageModel(modelId);
  }

  public createVideoModel(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the SDK model-ID literal suggestions and open string intersection; this primitive input cannot be mutated.
    modelId: VercelVideoModelId
  ): Experimental_VideoModelV4 {
    return this.getProvider().videoModel(modelId);
  }

  private provider?: ReturnType<typeof createGateway>;

  private getProvider(): ReturnType<typeof createGateway> {
    this.provider ??= createGateway({ apiKey: this.env.AI_GATEWAY_API_KEY });
    return this.provider;
  }

  private getApiKey(): string | undefined {
    const apiKey = this.env.AI_GATEWAY_API_KEY;
    return typeof apiKey === "string" && apiKey !== ""
      ? apiKey
      : this.env.VERCEL_OIDC_TOKEN;
  }

  public async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!(typeof apiKey === "string" && apiKey !== "")) {
      this.log.warn("No AI gateway API key found, using fallback models");
      return [...this.getFallbackModels(this.type)];
    }

    const url = "https://ai-gateway.vercel.sh/v1/models";
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

      const bodyRaw: unknown = await response.json();
      const body = aiGatewayModelsEnvelopeSchema.parse(bodyRaw);
      const unsupportedTypes = new Set<string>();
      const models: AiGatewayModel[] = [];

      for (const candidate of body.data) {
        const { type } = aiGatewayModelDiscriminatorSchema.parse(candidate);
        if (isAiGatewayModelType(type)) {
          const model = aiGatewayModelSchema.parse(candidate);
          models.push({ ...model, type });
        } else {
          unsupportedTypes.add(type);
        }
      }

      if (unsupportedTypes.size > EMPTY_MODEL_TYPE_COUNT) {
        this.log.warn(
          {
            modelCount: body.data.length,
            skippedModelCount: body.data.length - models.length,
            unsupportedTypes: [...unsupportedTypes],
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
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
export { VercelGateway as Gateway, VercelGateway };
