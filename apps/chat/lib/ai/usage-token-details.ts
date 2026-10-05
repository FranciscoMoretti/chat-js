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
): { cachedInputTokens: number; reasoningTokens: number } => ({
  cachedInputTokens:
    // oxlint-disable-next-line no-magic-numbers -- Historical records with neither cache count represent zero known cached tokens.
    usage?.inputTokenDetails?.cacheReadTokens ?? usage?.cachedInputTokens ?? 0,
  reasoningTokens:
    // oxlint-disable-next-line no-magic-numbers -- Historical records with neither reasoning count represent zero known reasoning tokens.
    usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens ?? 0,
});
