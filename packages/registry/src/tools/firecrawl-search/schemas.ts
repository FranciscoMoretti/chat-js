import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { searchQueriesSchema } from "@/tools/platform/search-presentation";
/* oxlint-enable sort-imports */

const webSearchInput = z.object({
  search_queries: searchQueriesSchema,
});

const searchResult = z.object({
  content: z.string(),
  title: z.string(),
  url: z.string(),
});

const searchQuery = z.object({ maxResults: z.number(), query: z.string() });
const queryResults = z.object({
  query: searchQuery,
  results: z.array(searchResult),
});
const webSearchResult = z.object({
  error: z.string().optional(),
  searches: z.array(queryResults),
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (webSearchInput, webSearchResult); the enabled import/no-default-export convention rejects the default-export alternative. */
export { webSearchInput, webSearchResult };
/* oxlint-enable import/no-named-export */
