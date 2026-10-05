import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";
/* oxlint-enable sort-imports */
import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AiGatewayModel } from "@chat-js/gateways/models";
/* oxlint-enable sort-imports */
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import type { ImageModel } from "ai";

interface OpenAICompatibleModelResponse {
  created: number;
  id: string;
  object: string;
  owned_by: string;
}

const UNKNOWN_MODEL_LIMIT = 0;
const UNKNOWN_MODEL_TIMESTAMP = 0;
const toAiGatewayModel = (
  model: Readonly<OpenAICompatibleModelResponse>
): AiGatewayModel => ({
  context_window: UNKNOWN_MODEL_LIMIT,
  created: model.created ?? UNKNOWN_MODEL_TIMESTAMP,
  description: "",
  id: model.id,
  max_tokens: UNKNOWN_MODEL_LIMIT,
  name: model.id,
  object: "model",
  owned_by: model.owned_by ?? "unknown",
  pricing: {},
  type: "language",
});

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
class OpenAICompatibleGateway
  extends GatewayRuntime
  implements GatewayProvider<"openai-compatible", string, string, never>
{
  public readonly type = "openai-compatible" as const;

  private getProvider(): ReturnType<typeof createOpenAICompatible> {
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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchModels's awaited sequencing and rejected-Promise behavior. */
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
      const models = (body.data ??
        []) as readonly Readonly<OpenAICompatibleModelResponse>[];
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
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Gateway, OpenAICompatibleGateway); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */
export { OpenAICompatibleGateway as Gateway, OpenAICompatibleGateway };
/* oxlint-enable import/no-named-export */
