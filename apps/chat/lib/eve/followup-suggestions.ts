import { z } from "zod";

export const eveFollowupSuggestions = z.object({
  suggestions: z.array(z.string().trim().min(1).max(80)).min(3).max(5),
});
