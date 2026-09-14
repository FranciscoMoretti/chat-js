import { z } from "zod";

import { searchQueriesSchema } from "@/tools/platform/search-presentation";

export const webSearchInput = z.object({
  search_queries: searchQueriesSchema,
});

const searchResult = z.object({
  content: z.string(),
  title: z.string(),
  url: z.string(),
});

export const webSearchResult = z.object({
  error: z.string().optional(),
  searches: z.array(
    z.object({
      query: z.object({ maxResults: z.number(), query: z.string() }),
      results: z.array(searchResult),
    })
  ),
});
