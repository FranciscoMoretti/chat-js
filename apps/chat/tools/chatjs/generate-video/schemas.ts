import { z } from "zod";

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

export const generateVideoResult = z.object({
  fileId: z.string().optional(),
  prompt: z.string(),
  videoUrl: z.string(),
});
