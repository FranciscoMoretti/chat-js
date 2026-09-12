import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";

export function getModelProviderOptions(model: {
  apiModelId: string;
  owned_by: string;
  reasoning: boolean;
}): SharedV4ProviderOptions {
  if (model.owned_by === "openai") {
    if (model.reasoning) {
      // Strip provider prefix (e.g. "openai/gpt-5-mini" → "gpt-5-mini")
      // so the check works for all gateways (Vercel uses prefixed IDs, OpenAI direct does not)
      const modelName = model.apiModelId.split("/").pop() ?? model.apiModelId;
      return {
        openai: {
          reasoningSummary: "auto",
          ...(modelName === "gpt-5" ||
          modelName === "gpt-5-mini" ||
          modelName === "gpt-5-nano"
            ? { reasoningEffort: "low" }
            : {}),
        } satisfies OpenAIResponsesProviderOptions,
      };
    }
    return { openai: {} };
  }
  if (model.owned_by === "anthropic") {
    if (model.reasoning) {
      return {
        anthropic: {
          thinking: {
            budgetTokens: 4096,
            type: "enabled",
          },
        } satisfies AnthropicProviderOptions,
      };
    }
    return { anthropic: {} };
  }
  if (model.owned_by === "xai") {
    return {
      xai: {},
    };
  }
  if (model.owned_by === "google") {
    if (model.reasoning) {
      return {
        google: {
          thinkingConfig: {
            thinkingBudget: 10_000,
          },
        } satisfies GoogleLanguageModelOptions,
      };
    }
    return { google: {} };
  }
  return {};
}
