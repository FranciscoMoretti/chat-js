import { z } from "zod";

const generateImageInput = z.object({
  prompt: z
    .string()
    .describe(
      "The user’s image prompt. The original intent, message, and meaning must remain unchanged. No new ideas, claims, or content may be introduced."
    ),
});

const generateImageResult = z.object({
  fileId: z.string().optional(),
  imageUrl: z.string(),
  prompt: z.string(),
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (generateImageInput, generateImageResult); the enabled import/no-default-export convention rejects the default-export alternative. */
export { generateImageInput, generateImageResult };
/* oxlint-enable import/no-named-export */
