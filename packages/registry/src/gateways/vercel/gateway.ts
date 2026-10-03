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

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
type VercelImageModelId = Parameters<(typeof gateway)["imageModel"]>[0];
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
type VercelVideoModelId = Parameters<(typeof gateway)["videoModel"]>[0];
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
type VercelLanguageModelId = StrictLiterals<
  Parameters<(typeof gateway)["languageModel"]>[0]
>;
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
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
  public readonly type = "vercel" as const;

  public createLanguageModel(modelId: VercelLanguageModelId): LanguageModelV4 {
    return this.getProvider()(modelId);
  }

  public createImageModel(modelId: VercelImageModelId): ImageModel {
    return this.getProvider().imageModel(modelId);
  }

  public createVideoModel(
    modelId: VercelVideoModelId
  ): Experimental_VideoModelV4 {
    return this.getProvider().videoModel(modelId);
  }

  private provider?: ReturnType<typeof createGateway>;

  private getProvider() {
    this.provider ??= createGateway({ apiKey: this.env.AI_GATEWAY_API_KEY });
    return this.provider;
  }

  private getApiKey(): string | undefined {
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- Empty strings intentionally select the fallback value here; nullish coalescing would preserve an unusable empty value.
    return this.env.AI_GATEWAY_API_KEY || this.env.VERCEL_OIDC_TOKEN;
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export { VercelGateway as Gateway };
/* oxlint-enable import/group-exports */
