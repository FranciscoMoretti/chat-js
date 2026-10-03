import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { SharedV4ProviderOptions } from "@ai-sdk/provider";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const getModelProviderOptions = (model: {
  apiModelId: string;
  owned_by: string;
  reasoning: boolean;
}): SharedV4ProviderOptions => {
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
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
