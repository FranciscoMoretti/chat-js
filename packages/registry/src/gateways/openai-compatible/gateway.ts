import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
import type { AiGatewayModel } from "@chat-js/gateways/models";
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import type { ImageModel } from "ai";

interface OpenAICompatibleModelResponse {
  created: number;
  id: string;
  object: string;
  owned_by: string;
}

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const toAiGatewayModel = (
  model: OpenAICompatibleModelResponse
): AiGatewayModel => ({
  context_window: 0,
  created: model.created ?? 0,
  description: "",
  id: model.id,
  max_tokens: 0,
  name: model.id,
  object: "model",
  owned_by: model.owned_by ?? "unknown",
  pricing: {},
  type: "language",
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
class OpenAICompatibleGateway
  extends GatewayRuntime
  implements GatewayProvider<"openai-compatible", string, string, never>
{
  public readonly type = "openai-compatible" as const;

  private getProvider() {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();
    if (!(typeof baseURL === "string" && baseURL !== "")) {
      throw new Error("OPENAI_COMPATIBLE_BASE_URL is not configured");
    }
    return createOpenAICompatible({
      apiKey,
      baseURL,
      name: "openai-compatible",
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
  // eslint-disable-next-line class-methods-use-this -- GatewayProvider requires this instance factory even when the provider does not support this model type.
  public createVideoModel(_modelId: never): Experimental_VideoModelV4 | null {
    return null;
  }

  private getApiKey(): string | undefined {
    return this.env.OPENAI_COMPATIBLE_API_KEY;
  }

  private getBaseURL(): string | undefined {
    return this.env.OPENAI_COMPATIBLE_BASE_URL;
  }

  public async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();
    const baseURL = this.getBaseURL();

    if (!(typeof baseURL === "string" && baseURL !== "")) {
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
      if (typeof apiKey === "string" && apiKey !== "") {
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

      // oxlint-disable-next-line typescript/no-unsafe-assignment -- Retain the current provider-response compatibility contract; adding strict provider schemas would require deciding how unknown model fields and provider variants are handled.
      const body = await response.json();
      // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- Retain the current provider-response compatibility contract; adding strict provider schemas would require deciding how unknown model fields and provider variants are handled.
      const models = (body.data ?? []) as OpenAICompatibleModelResponse[];
      const result = models.map((model) => toAiGatewayModel(model));

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-statements */
export { OpenAICompatibleGateway as Gateway, OpenAICompatibleGateway };
