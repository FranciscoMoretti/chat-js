import { z } from "zod";

const MINIMUM_VIDEO_DURATION_SECONDS = 1;
const MAXIMUM_VIDEO_DURATION_SECONDS = 10;

const generateVideoInput = z.object({
  aspectRatio: z
    .enum(["16:9", "9:16", "1:1"])
    .optional()
    .describe("Optional output aspect ratio. Defaults to 16:9."),
  durationSeconds: z
    .number()
    .int()
    .min(MINIMUM_VIDEO_DURATION_SECONDS)
    .max(MAXIMUM_VIDEO_DURATION_SECONDS)
    .optional()
    .describe("Optional video duration in seconds. Defaults to 5."),
  prompt: z
    .string()
    .describe("A descriptive prompt for the video to generate."),
});

const generateVideoResult = z.object({
  fileId: z.string().optional(),
  prompt: z.string(),
  videoUrl: z.string(),
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (generateVideoInput, generateVideoResult); the enabled import/no-default-export convention rejects the default-export alternative. */
export { generateVideoInput, generateVideoResult };
/* oxlint-enable import/no-named-export */
