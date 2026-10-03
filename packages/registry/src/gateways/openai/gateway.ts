import { createOpenAI } from "@ai-sdk/openai";
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
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type {
  ExtractImageModelIdFromProvider,
  ExtractModelIdFromProvider,
  StrictLiterals,
} from "@chat-js/gateways/provider-types";
/* oxlint-enable eslint/sort-imports */
import { GatewayRuntime } from "@chat-js/gateways/runtime";
import type { ImageModel } from "ai";

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

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const toAiGatewayModel = (model: OpenAIModelResponse): AiGatewayModel => ({
  context_window: 0,
  created: model.created ?? 0,
  description: "",
  id: model.id,
  max_tokens: 0,
  name: model.id,
  object: "model",
  owned_by:
    (model.owned_by === "system" ? "openai" : model.owned_by) ?? "openai",
  pricing: {},
  type: "language",
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export class OpenAIGateway
  extends GatewayRuntime
  implements
    GatewayProvider<"openai", OpenaiLanguageModelId, OpenaiImageModelId, never>
{
  public readonly type = "openai" as const;

  private getProvider() {
    const apiKey = this.getApiKey();
    if (!(typeof apiKey === "string" && apiKey !== "")) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    return createOpenAI({ apiKey });
  }

  public createLanguageModel(modelId: OpenaiLanguageModelId): LanguageModelV4 {
    const provider = this.getProvider();
    return provider(modelId);
  }

  public createImageModel(modelId: OpenaiImageModelId): ImageModel {
    const provider = this.getProvider();
    return provider.image(modelId);
  }

  // The gateway interface requires a video factory even when unsupported.
  // eslint-disable-next-line class-methods-use-this
  public createVideoModel(_modelId: never): Experimental_VideoModelV4 | null {
    return null;
  }

  private getApiKey(): string | undefined {
    return this.env.OPENAI_API_KEY;
  }

  public async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!(typeof apiKey === "string" && apiKey !== "")) {
      this.log.warn("No OPENAI_API_KEY found, using fallback models");
      return [...this.getFallbackModels(this.type)];
    }

    const url = "https://api.openai.com/v1/models";
    this.log.debug({ url }, "Fetching models from OpenAI");

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
          "OpenAI returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      // oxlint-disable-next-line typescript/no-unsafe-assignment -- Retain the current provider-response compatibility contract; adding strict provider schemas would require deciding how unknown model fields and provider variants are handled.
      const body = await response.json();
      // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- Retain the current provider-response compatibility contract; adding strict provider schemas would require deciding how unknown model fields and provider variants are handled.
      const models = (body.data ?? []) as OpenAIModelResponse[];
      const result = models.map((model) => toAiGatewayModel(model));

      this.log.info(
        { modelCount: result.length },
        "Successfully fetched models from OpenAI"
      );
      return result;
    } catch (error) {
      this.log.error(
        { err: error, url },
        "Error fetching models from OpenAI, falling back to generated models"
      );
      return [...this.getFallbackModels(this.type)];
    }
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export { OpenAIGateway as Gateway };
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
