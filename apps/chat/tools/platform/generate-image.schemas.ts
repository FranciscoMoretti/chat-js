import { z } from "zod";

import { keyFromFileUrl } from "@/lib/file-url";

export const generateImageInput = z.object({
  prompt: z
    .string()
    .describe(
      "The user’s image prompt. Preserve its original intent, message, and meaning."
    ),
});
export const generateImageOutput = z.object({
  imageUrl: z
    .string()
    .refine(
      (value) =>
        value.startsWith("/api/files/content?") &&
        keyFromFileUrl(value) !== null,
      "Use a ChatJS image upload"
    ),
  prompt: z.string(),
});
