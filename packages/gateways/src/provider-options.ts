import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";

const ANTHROPIC_REASONING_BUDGET_TOKENS = 4096;
const GOOGLE_REASONING_BUDGET_TOKENS = 10_000;

const getOpenAIProviderOptions = (
  apiModelId: string,
  reasoning: boolean
): OpenAIResponsesProviderOptions => {
  if (!reasoning) {
    return {};
  }
  // Vercel IDs include the provider prefix; direct OpenAI IDs do not.
  const modelName = apiModelId.split("/").pop() ?? apiModelId;
  const options: OpenAIResponsesProviderOptions = {
    reasoningSummary: "auto",
  };
  if (
    modelName === "gpt-5" ||
    modelName === "gpt-5-mini" ||
    modelName === "gpt-5-nano"
  ) {
    options.reasoningEffort = "low";
  }
  return options;
};

const getModelProviderOptions = (
  model: Readonly<{
    apiModelId: string;
    owned_by: string;
    reasoning: boolean;
  }>
): SharedV4ProviderOptions => {
  switch (model.owned_by) {
    case "openai": {
      return {
        openai: getOpenAIProviderOptions(model.apiModelId, model.reasoning),
      };
    }
    case "anthropic": {
      if (model.reasoning) {
        return {
          anthropic: {
            thinking: {
              budgetTokens: ANTHROPIC_REASONING_BUDGET_TOKENS,
              type: "enabled",
            },
          } satisfies AnthropicProviderOptions,
        };
      }
      return { anthropic: {} satisfies AnthropicProviderOptions };
    }
    case "xai": {
      return { xai: {} };
    }
    case "google": {
      if (model.reasoning) {
        return {
          google: {
            thinkingConfig: {
              thinkingBudget: GOOGLE_REASONING_BUDGET_TOKENS,
            },
          } satisfies GoogleLanguageModelOptions,
        };
      }
      return { google: {} satisfies GoogleLanguageModelOptions };
    }
    default: {
      return {};
    }
  }
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing package entry bindings (getModelProviderOptions); the enabled import/no-default-export convention rejects the default-export alternative. */
export { getModelProviderOptions };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
