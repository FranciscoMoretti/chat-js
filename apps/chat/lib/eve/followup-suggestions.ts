import type { EveMessage } from "eve/client";
import { z } from "zod";

/* oxlint-disable import/group-exports, no-magic-numbers --
 * import/group-exports (#523): eveFollowupSuggestions stays exported at its declaration so its public contract is visible beside its implementation.
 * no-magic-numbers (#517): eveFollowupSuggestions uses 1, 80, 3, 5 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const eveFollowupSuggestions = z.object({
  suggestions: z.array(z.string().trim().min(1).max(80)).min(3).max(5),
});
/* oxlint-enable import/group-exports, no-magic-numbers */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns --
 * import/group-exports (#523): messageFollowupSuggestions stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): messageFollowupSuggestions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): messageFollowupSuggestions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
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
