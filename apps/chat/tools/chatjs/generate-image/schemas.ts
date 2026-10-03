import { z } from "zod";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const generateImageInput = z.object({
  prompt: z
    .string()
    .describe(
      "The user’s image prompt. The original intent, message, and meaning must remain unchanged. No new ideas, claims, or content may be introduced."
    ),
});
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const generateImageResult = z.object({
  fileId: z.string().optional(),
  imageUrl: z.string(),
  prompt: z.string(),
});
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
