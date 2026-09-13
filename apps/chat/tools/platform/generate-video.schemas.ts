import { z } from "zod";

import { keyFromFileUrl } from "@/lib/file-url";

export const generateVideoInput = z.object({
  prompt: z
    .string()
    .describe("A descriptive prompt for the video to generate."),
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
});

export const generateVideoOutput = z.object({
  videoUrl: z
    .string()
    .refine(
      (value) =>
        value.startsWith("/api/files/content?") &&
        keyFromFileUrl(value) !== null,
      "Use a ChatJS video upload"
    ),
  prompt: z.string(),
});
