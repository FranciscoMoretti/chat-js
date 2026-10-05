import { z } from "zod";

const retrievedInput = z.object({
  url: z.string().describe("The URL to retrieve the information from."),
});

const retrievedContent = z
  .object({
    content: z.string(),
    description: z.string(),
    language: z.string().optional(),
    title: z.string(),
    url: z.string(),
  })
  .transform((item) => ({ ...item, language: item.language }));
const retrievalFailure = z
  .object({ error: z.string().optional() })
  .transform((item) => ({ error: item.error }));
const retrievedResult = z.union([
  z.object({ error: z.string() }),
  z.object({ results: z.array(retrievedContent) }),
  z.object({ results: z.array(retrievalFailure) }),
]);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (retrievedInput, retrievedResult); the enabled import/no-default-export convention rejects the default-export alternative. */
export { retrievedInput, retrievedResult };
/* oxlint-enable import/no-named-export */
