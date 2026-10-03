import { z } from "zod";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const retrievedInput = z.object({
  url: z.string().describe("The URL to retrieve the information from."),
});
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
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
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable import/group-exports */
