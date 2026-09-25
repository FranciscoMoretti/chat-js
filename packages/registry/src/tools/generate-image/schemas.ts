import { z } from "zod";

export const generateImageInput = z.object({
  prompt: z
    .string()
    .describe(
      "The user’s image prompt. The original intent, message, and meaning must remain unchanged. No new ideas, claims, or content may be introduced."
    ),
});

export const generateImageResult = z.object({
  fileId: z.string().optional(),
  imageUrl: z.string(),
  prompt: z.string(),
});
