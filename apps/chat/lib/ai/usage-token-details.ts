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

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types  --
 * import/no-named-export (#527): Preserve the named getUsageTokenDetails API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getUsageTokenDetails uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-optional-chaining (#542): getUsageTokenDetails handles optional usage?.inputTokenDetails?.cacheReadTokens; usage?.cachedInputTokens; usage?.outputTokenDetails?.reasoningTokens; usage?.reasoningTokens without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep getUsageTokenDetails's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getUsageTokenDetails's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): getUsageTokenDetails accepts usage?: StoredLanguageModelUsage; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const getUsageTokenDetails = (usage?: StoredLanguageModelUsage) => ({
  cachedInputTokens:
    usage?.inputTokenDetails?.cacheReadTokens ?? usage?.cachedInputTokens ?? 0,
  reasoningTokens:
    usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens ?? 0,
});
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
