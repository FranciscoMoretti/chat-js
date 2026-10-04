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
