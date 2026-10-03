import { z } from "zod";

import { searchQueriesSchema } from "@/tools/platform/search-presentation";

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const webSearchInput = z.object({
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
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

const searchResult = z.object({
  content: z.string(),
  title: z.string(),
  url: z.string(),
});

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
export const webSearchResult = z.object({
  error: z.string().optional(),
  searches: z.array(
    z.object({
      query: z.object({ maxResults: z.number(), query: z.string() }),
      results: z.array(searchResult),
    })
  ),
});
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable import/group-exports */
