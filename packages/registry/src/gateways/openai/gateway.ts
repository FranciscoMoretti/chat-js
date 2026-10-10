import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
} from "@ai-sdk/provider";

import type {
  ExtractImageModelIdFromProvider,
  ExtractModelIdFromProvider,
  StrictLiterals,
} from "@chat-js/gateways/provider-types";

import type { AiGatewayModel } from "@chat-js/gateways/models";

import type { GatewayProvider } from "@chat-js/gateways/gateway-provider";

import { GatewayRuntime } from "@chat-js/gateways/runtime";

import type { ImageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

type OpenaiLanguageModelId = StrictLiterals<
  ExtractModelIdFromProvider<typeof createOpenAI>
>;
type OpenaiImageModelId = StrictLiterals<
  ExtractImageModelIdFromProvider<typeof createOpenAI>
>;

const providerModelSchema = z.object({
  created: z.number().nullish(),
  id: z.string(),
  owned_by: z.string().nullish(),
});
type OpenAIModelResponse = z.output<typeof providerModelSchema>;
const providerModelListSchema = z.object({
  data: z.array(z.unknown()),
});

const EMPTY_MODEL_COUNT = 0;
const UNKNOWN_MODEL_LIMIT = 0;
const UNKNOWN_MODEL_TIMESTAMP = 0;
const toAiGatewayModel = (
  model: Readonly<OpenAIModelResponse>
): AiGatewayModel => ({
  context_window: UNKNOWN_MODEL_LIMIT,
  created: model.created ?? UNKNOWN_MODEL_TIMESTAMP,
  description: "",
  id: model.id,
  max_tokens: UNKNOWN_MODEL_LIMIT,
  name: model.id,
  object: "model",
  owned_by:
    // oxlint-disable-next-line no-ternary -- Keep ?? operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    (model.owned_by === "system" ? "openai" : model.owned_by) ?? "openai",
  pricing: {},
  type: "language",
});

// Validate the wire envelope separately from each model so valid neighbors survive.
const parseProviderModels = (value: unknown): AiGatewayModel[] => {
  const body = providerModelListSchema.parse(value);
  const result = body.data.flatMap((entry): AiGatewayModel[] => {
    const model = providerModelSchema.safeParse(entry);
    if (!model.success) {
      return [];
    }
    return [toAiGatewayModel(model.data)];
  });
  // A genuinely empty catalog is valid; a nonempty unparseable catalog is not.
  if (
    body.data.length > EMPTY_MODEL_COUNT &&
    result.length === EMPTY_MODEL_COUNT
  ) {
    throw new Error("Provider catalog contains no valid models.");
  }
  return result;
};

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
class OpenAIGateway
  extends GatewayRuntime
  implements
    GatewayProvider<"openai", OpenaiLanguageModelId, OpenaiImageModelId, never>
{
  public readonly type = "openai" as const;

  private getProvider(): ReturnType<typeof createOpenAI> {
    const apiKey = this.getApiKey();
    if (!(typeof apiKey === "string" && apiKey !== "")) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    return createOpenAI({ apiKey });
  }

  public createLanguageModel(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the SDK literal suggestions and open string intersection: downstream StrictLiterals derives configuration model IDs from this exact factory parameter. A plain string erases that contract; the faithful primitive-preserving readonly projection retains the alias and the pinned rule still flags it.
    modelId: ExtractModelIdFromProvider<typeof createOpenAI>
  ): LanguageModelV4 {
    const provider = this.getProvider();
    return provider(modelId);
  }

  public createImageModel(modelId: OpenaiImageModelId): ImageModel {
    const provider = this.getProvider();
    return provider.image(modelId);
  }

  // The gateway interface requires a video factory even when unsupported.
  // eslint-disable-next-line class-methods-use-this -- GatewayProvider requires this instance slot; unsupported video is represented by null, so this factory must remain callable on provider instances.
  public createVideoModel(_modelId: never): Experimental_VideoModelV4 | null {
    return null;
  }

  private getApiKey(): string | undefined {
    return this.env.OPENAI_API_KEY;
  }

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchModels's awaited sequencing and rejected-Promise behavior. */
  // oxlint-disable-next-line eslint/max-statements -- Preserve the native fetch, response validation, ordered log calls, and catch fallback in one operation; the exact unmasked statement count is recorded in the lane evidence.
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

      const result = parseProviderModels(await response.json());

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
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-enable unicorn/no-null */
// oxlint-disable-next-line import/no-named-export -- Keep the existing named module bindings (Gateway, OpenAIGateway); the enabled import/no-default-export convention rejects the default-export alternative.
export { OpenAIGateway as Gateway, OpenAIGateway };
