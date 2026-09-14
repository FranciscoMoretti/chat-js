import { z } from "zod";

export const retrievedInput = z.object({
  url: z.string().describe("The URL to retrieve the information from."),
});

export const retrievedResult = z.union([
  z.object({ error: z.string() }),
  z.object({
    results: z.array(
      z
        .object({
          content: z.string(),
          description: z.string(),
          language: z.string().optional(),
          title: z.string(),
          url: z.string(),
        })
        .transform((item) => ({ ...item, language: item.language }))
    ),
  }),
  z.object({
    results: z.array(
      z
        .object({ error: z.string().optional() })
        .transform((item) => ({ error: item.error }))
    ),
  }),
]);
