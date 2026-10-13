import { z } from "zod";

import type { ReadonlyEveMessageMetadata } from "./readonly-message-types";

const eveFollowupSuggestions = z.object({
  suggestions: z.array(z.string().trim().min(1).max(80)).min(3).max(5),
});

/** Invalid or unavailable suggestions never hide the completed answer.
 * @param {{ readonly metadata?: ReadonlyEveMessageMetadata }} message Completed message metadata whose followup-suggestions annotation is validated.
 * @returns {string[]} Trimmed distinct suggestions in their original order, or an empty list when the annotation is unavailable or fails the schema.
 */
const messageFollowupSuggestions = (message: {
  readonly metadata?: ReadonlyEveMessageMetadata;
}): string[] => {
  const parsed = eveFollowupSuggestions.safeParse(
    message.metadata?.annotations?.["followup-suggestions"]
  );

  if (parsed.success) {
    return [...new Set(parsed.data.suggestions)];
  }
  return [];
};
export { eveFollowupSuggestions, messageFollowupSuggestions };
