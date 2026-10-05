import type { LanguageModelUsage } from "ai";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-disable import/no-named-export -- Keep the named type bindings (StoredLanguageModelUsage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getUsageTokenDetails); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const getUsageTokenDetails = (
  usage?: ReadonlyNativeSurface<StoredLanguageModelUsage>
): { cachedInputTokens: number; reasoningTokens: number } => ({
  cachedInputTokens:
    // oxlint-disable-next-line no-magic-numbers, oxc/no-optional-chaining -- Historical records with neither cache count represent zero known cached tokens. Optional chain: Saved pre-SDK7 records may omit inputTokenDetails and the entire usage argument; nested missing cache counts must use legacy cachedInputTokens/zero. The app guidance prefers optional chaining. Legacy cachedInputTokens lookup follows optional usage argument; absent usage must return zero. The app guidance prefers optional chaining.
    usage?.inputTokenDetails?.cacheReadTokens ?? usage?.cachedInputTokens ?? 0,
  reasoningTokens:
    // oxlint-disable-next-line no-magic-numbers, oxc/no-optional-chaining -- Historical records with neither reasoning count represent zero known reasoning tokens. Optional chain: Saved pre-SDK7 records may omit outputTokenDetails and the entire usage argument; nested missing reasoning counts must use legacy reasoningTokens/zero. The app guidance prefers optional chaining. Legacy reasoningTokens lookup follows optional usage argument; absent usage must return zero. The app guidance prefers optional chaining.
    usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens ?? 0,
});
/* oxlint-enable import/no-named-export */
