import { z } from "zod";

import { searchQueriesSchema } from "@/tools/platform/search-presentation";

const webSearchInput = z.object({
  search_queries: searchQueriesSchema,
});

const searchResult = z.object({
  content: z.string(),
  title: z.string(),
  url: z.string(),
});

/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
const webSearchResult = z.object({
  error: z.string().optional(),
  searches: z.array(
    z.object({
      query: z.object({ maxResults: z.number(), query: z.string() }),
      results: z.array(searchResult),
    })
  ),
});
/* oxlint-enable unicorn/max-nested-calls */
export { webSearchInput, webSearchResult };
