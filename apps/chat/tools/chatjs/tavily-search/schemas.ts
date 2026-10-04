import { z } from "zod";

import { searchQueriesSchema } from "@/tools/platform/search-presentation";

const webSearchInput = z.object({
  exclude_domains: z
    .array(z.string())
    .describe(
      "Domains to exclude from all results. Pass null for no exclusions."
    )
    .nullable(),
  searchDepth: z
    .enum(["basic", "advanced"])
    .describe('Search depth to use. Pass null for "basic".')
    .nullable(),
  search_queries: searchQueriesSchema,
  topics: z
    .array(z.enum(["general", "news"]))
    .describe(
      "Array of topic types to search for. Pass null for general search."
    )
    .nullable(),
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
export { webSearchInput, webSearchResult };
