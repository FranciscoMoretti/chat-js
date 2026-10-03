import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
/* oxlint-enable eslint/sort-imports */
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { AiGatewayModel } from "@chat-js/gateways/models";
/* oxlint-enable eslint/sort-imports */
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import type { ImageModel } from "ai";
import { z } from "zod";

const TRAILING_SLASHES_REGEX = /\/+$/u;

/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
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
/* oxlint-enable unicorn/max-nested-calls */

type LiteLLMModelResponse = z.infer<
  typeof litellmModelsResponseSchema
>["data"][number];

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const toAiGatewayModel = (model: LiteLLMModelResponse): AiGatewayModel => ({
  context_window: 0,
  created: model.created ?? 0,
  description: "",
  id: model.id,
  max_tokens: 0,
  name: model.id,
  object: "model",
  owned_by: model.owned_by ?? "litellm",
  pricing: {},
  type: "language",
});
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export class LiteLLMGateway
  extends GatewayRuntime
  implements GatewayProvider<"litellm", string, string, never>
{
  public readonly type = "litellm" as const;

  private getProvider() {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();
    if (!(typeof baseURL === "string" && baseURL !== "")) {
      throw new Error("LITELLM_BASE_URL is not configured");
    }
    return createOpenAICompatible({
      apiKey,
      baseURL,
      name: "litellm",
    });
  }

  public createLanguageModel(modelId: string): LanguageModelV4 {
    const provider = this.getProvider();
    return provider(modelId);
  }

  public createImageModel(modelId: string): ImageModel {
    const provider = this.getProvider();
    return provider.imageModel(modelId);
  }

  // The gateway interface requires a video factory even when unsupported.
  // eslint-disable-next-line class-methods-use-this
  public createVideoModel(_modelId: never): Experimental_VideoModelV4 | null {
    return null;
  }

  private getApiKey(): string | undefined {
    return this.env.LITELLM_API_KEY;
  }

  private getBaseURL(): string | undefined {
    return this.env.LITELLM_BASE_URL;
  }

  // The URL shape is provider-defined and independent of instance state.
  // eslint-disable-next-line class-methods-use-this
  private getModelsUrl(baseURL: string): string {
    const normalizedBaseURL = baseURL.replace(TRAILING_SLASHES_REGEX, "");
    if (normalizedBaseURL.endsWith("/v1")) {
      return `${normalizedBaseURL}/models`;
    }
    return `${normalizedBaseURL}/v1/models`;
  }

  public async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();

    if (!(typeof baseURL === "string" && baseURL !== "")) {
      this.log.warn("No LITELLM_BASE_URL found, using fallback models");
      return [...this.getFallbackModels(this.type)];
    }

    const url = this.getModelsUrl(baseURL);
    this.log.debug({ url }, "Fetching models from LiteLLM proxy");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (typeof apiKey === "string" && apiKey !== "") {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await this.fetch(url, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.log.error(
          { status: response.status, statusText: response.statusText, url },
          "LiteLLM proxy returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const body = litellmModelsResponseSchema.parse(await response.json());
      const models = body.data;
      const result = models.map((model) => toAiGatewayModel(model));

      this.log.info(
        { modelCount: result.length },
        "Successfully fetched models from LiteLLM proxy"
      );
      return result;
    } catch (error) {
      this.log.error(
        { err: error, url },
        "Error fetching models from LiteLLM proxy, falling back to generated models"
      );
      return [...this.getFallbackModels(this.type)];
    }
  }
}
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export { LiteLLMGateway as Gateway };
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
