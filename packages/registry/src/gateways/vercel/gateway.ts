import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import {
  aiGatewayModelDiscriminatorSchema,
  aiGatewayModelSchema,
  aiGatewayModelsEnvelopeSchema,
  isAiGatewayModelType,
} from "@chat-js/gateways/models";
import type { AiGatewayModel } from "@chat-js/gateways/models";
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import type { ImageModel } from "ai";
import type { StrictLiterals } from "@chat-js/gateways/provider-types";

import { createGateway } from "@ai-sdk/gateway";
import type { gateway } from "@ai-sdk/gateway";

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

  public createLanguageModel(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the SDK literal suggestions and open string intersection: downstream StrictLiterals derives configuration model IDs from this exact factory parameter. A plain string erases that contract; the faithful primitive-preserving readonly projection retains the alias and the pinned rule still flags it.
    modelId: Parameters<
      (typeof gateway)["languageModel"]
    >[typeof MODEL_ID_PARAMETER_INDEX]
  ): LanguageModelV4 {
    return this.getProvider()(modelId);
  }

  public createImageModel(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the SDK literal suggestions and open string intersection: downstream StrictLiterals derives configuration model IDs from this exact factory parameter. A plain string erases that contract; the faithful primitive-preserving readonly projection retains the alias and the pinned rule still flags it.
    modelId: VercelImageModelId
  ): ImageModel {
    return this.getProvider().imageModel(modelId);
  }

  public createVideoModel(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the SDK literal suggestions and open string intersection: downstream StrictLiterals derives configuration model IDs from this exact factory parameter. A plain string erases that contract; the faithful primitive-preserving readonly projection retains the alias and the pinned rule still flags it.
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

    if (typeof apiKey === "string" && apiKey !== "") {
      return apiKey;
    }
    return this.env.VERCEL_OIDC_TOKEN;
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchModels's awaited sequencing and rejected-Promise behavior. */
  // oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function -- This ordered gateway fetch validates and filters the native catalog, reports unsupported types, and catches failures before fallback; native counts are 27 statements and 66 lines against limits 10/50.
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
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing model own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
  /* oxlint-enable oxc/no-async-await */
}
// oxlint-disable-next-line import/no-named-export -- Keep the existing named module bindings (Gateway, VercelGateway); the enabled import/no-default-export convention rejects the default-export alternative.
export { VercelGateway as Gateway, VercelGateway };
