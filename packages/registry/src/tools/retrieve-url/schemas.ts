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
          title: z.string(),
          content: z.string(),
          url: z.string(),
          description: z.string(),
          language: z.string().optional(),
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
