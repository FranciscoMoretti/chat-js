import type { EveMessage } from "eve/client";
import { z } from "zod";

/* oxlint-disable import/group-exports, no-magic-numbers  --
 * import/group-exports (#523): eveFollowupSuggestions stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveFollowupSuggestions API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): eveFollowupSuggestions uses 1, 80, 3, 5 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const eveFollowupSuggestions = z.object({
  suggestions: z.array(z.string().trim().min(1).max(80)).min(3).max(5),
});
/* oxlint-enable import/group-exports, no-magic-numbers */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns  --
 * import/group-exports (#523): messageFollowupSuggestions stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named messageFollowupSuggestions API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): messageFollowupSuggestions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): messageFollowupSuggestions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-ternary (#518): messageFollowupSuggestions derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-optional-chaining (#542): messageFollowupSuggestions handles optional message.metadata?.annotations?.["followup-suggestions"] without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
/** Invalid or unavailable suggestions never hide the completed answer. */
export const messageFollowupSuggestions = (
  message: Pick<EveMessage, "metadata">
): string[] => {
  const parsed = eveFollowupSuggestions.safeParse(
    message.metadata?.annotations?.["followup-suggestions"]
  );
  return parsed.success ? [...new Set(parsed.data.suggestions)] : [];
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns */
