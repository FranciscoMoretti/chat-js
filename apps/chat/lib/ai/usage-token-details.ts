import type { LanguageModelUsage } from "ai";

// Saved conversations may predate SDK 7's nested usage fields.
export type StoredLanguageModelUsage = Pick<
  LanguageModelUsage,
  "inputTokens" | "outputTokens" | "totalTokens"
> &
  Partial<
    Pick<LanguageModelUsage, "inputTokenDetails" | "outputTokenDetails">
  > & {
    cachedInputTokens?: number;
    reasoningTokens?: number;
  };

export function getUsageTokenDetails(usage?: StoredLanguageModelUsage) {
  return {
    cachedInputTokens:
      usage?.inputTokenDetails?.cacheReadTokens ??
      usage?.cachedInputTokens ??
      0,
    reasoningTokens:
      usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens ?? 0,
  };
}
