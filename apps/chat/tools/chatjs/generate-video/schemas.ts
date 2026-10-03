import { z } from "zod";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const generateVideoInput = z.object({
  aspectRatio: z
    .enum(["16:9", "9:16", "1:1"])
    .optional()
    .describe("Optional output aspect ratio. Defaults to 16:9."),
  durationSeconds: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("Optional video duration in seconds. Defaults to 5."),
  prompt: z
    .string()
    .describe("A descriptive prompt for the video to generate."),
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const generateVideoResult = z.object({
  fileId: z.string().optional(),
  prompt: z.string(),
  videoUrl: z.string(),
});
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
