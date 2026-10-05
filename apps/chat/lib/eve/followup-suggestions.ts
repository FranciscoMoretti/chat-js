import type { EveMessage } from "eve/client";
import { z } from "zod";

/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): eveFollowupSuggestions uses 1, 80, 3, 5 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
const eveFollowupSuggestions = z.object({
  suggestions: z.array(z.string().trim().min(1).max(80)).min(3).max(5),
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns -- jsdoc/require-param (#534): messageFollowupSuggestions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): messageFollowupSuggestions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags. */
/** Invalid or unavailable suggestions never hide the completed answer. */
const messageFollowupSuggestions = (
  message: Pick<EveMessage, "metadata">
): string[] => {
  const parsed = eveFollowupSuggestions.safeParse(
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading "followup-suggestions" from message.metadata.annotations; read annotations from message.metadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    message.metadata?.annotations?.["followup-suggestions"]
  );

  if (parsed.success) {
    return [...new Set(parsed.data.suggestions)];
  }
  return [];
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveFollowupSuggestions, messageFollowupSuggestions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */
export { eveFollowupSuggestions, messageFollowupSuggestions };
/* oxlint-enable import/no-named-export */
