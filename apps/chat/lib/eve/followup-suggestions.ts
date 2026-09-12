import type { EveMessage } from "eve/client";
import { z } from "zod";

export const eveFollowupSuggestions = z.object({
  suggestions: z.array(z.string().trim().min(1).max(80)).min(3).max(5),
});

/** Invalid or unavailable suggestions never hide the completed answer. */
export function messageFollowupSuggestions(
  message: Pick<EveMessage, "metadata">
): string[] {
  const parsed = eveFollowupSuggestions.safeParse(
    message.metadata?.annotations?.["followup-suggestions"]
  );
  return parsed.success ? [...new Set(parsed.data.suggestions)] : [];
}
