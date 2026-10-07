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
  return {
    reasoningSummary: "auto",
    // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- Conditional spread (modelName === "gpt-5" ||     modelName === "gpt-5-mini" ||     modelName === "gpt-5-nano"       ? { reasoningEffort: "low" }       : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(modelName === "gpt-5" ||
    modelName === "gpt-5-mini" ||
    modelName === "gpt-5-nano"
      ? { reasoningEffort: "low" }
      : {}),
  };
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
      return {
        // oxlint-disable-next-line no-ternary -- Keep SatisfiesExpression as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        anthropic: (model.reasoning
          ? {
              thinking: {
                budgetTokens: ANTHROPIC_REASONING_BUDGET_TOKENS,
                type: "enabled",
              },
            }
          : {}) satisfies AnthropicProviderOptions,
      };
    }
    case "xai": {
      return { xai: {} };
    }
    case "google": {
      return {
        // oxlint-disable-next-line no-ternary -- Keep SatisfiesExpression as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        google: (model.reasoning
          ? {
              thinkingConfig: {
                thinkingBudget: GOOGLE_REASONING_BUDGET_TOKENS,
              },
            }
          : {}) satisfies GoogleLanguageModelOptions,
      };
    }
    default: {
      return {};
    }
  }
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing package entry bindings (getModelProviderOptions); the enabled import/no-default-export convention rejects the default-export alternative. */
export { getModelProviderOptions };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
