import { createGateway } from "@ai-sdk/gateway";
import type { gateway } from "@ai-sdk/gateway";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
/* oxlint-enable sort-imports */
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  aiGatewayModelDiscriminatorSchema,
  aiGatewayModelSchema,
  aiGatewayModelsEnvelopeSchema,
  isAiGatewayModelType,
} from "@chat-js/gateways/models";
/* oxlint-enable sort-imports */
import type { AiGatewayModel } from "@chat-js/gateways/models";
import type { StrictLiterals } from "@chat-js/gateways/provider-types";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { GatewayRuntime } from "@chat-js/gateways/runtime";
/* oxlint-enable sort-imports */
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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchModels's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Gateway, VercelGateway); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
export { VercelGateway as Gateway, VercelGateway };
/* oxlint-enable import/no-named-export */
