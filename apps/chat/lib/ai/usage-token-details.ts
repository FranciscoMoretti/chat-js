import type { LanguageModelUsage } from "ai";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

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

export const getUsageTokenDetails = (
  usage?: ReadonlyNativeSurface<StoredLanguageModelUsage>
): { cachedInputTokens: number; reasoningTokens: number } => {
  const inputTokenDetails = usage && usage.inputTokenDetails;
  const cachedInputTokens =
    (inputTokenDetails && inputTokenDetails.cacheReadTokens) ??
    (usage && usage.cachedInputTokens) ??
    0;
  const outputTokenDetails = usage && usage.outputTokenDetails;
  return {
    cachedInputTokens,
    reasoningTokens:
      (outputTokenDetails && outputTokenDetails.reasoningTokens) ??
      (usage && usage.reasoningTokens) ??
      0,
  };
};
