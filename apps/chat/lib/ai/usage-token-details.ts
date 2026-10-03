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

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): getUsageTokenDetails uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): getUsageTokenDetails accepts usage?: StoredLanguageModelUsage; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const getUsageTokenDetails = (
  usage?: StoredLanguageModelUsage
): { cachedInputTokens: number; reasoningTokens: number } => ({
  cachedInputTokens:
    usage?.inputTokenDetails?.cacheReadTokens ?? usage?.cachedInputTokens ?? 0,
  reasoningTokens:
    usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens ?? 0,
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
