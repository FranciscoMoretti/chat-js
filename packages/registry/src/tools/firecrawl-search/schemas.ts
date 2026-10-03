import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { searchQueriesSchema } from "@/tools/platform/search-presentation";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const webSearchInput = z.object({
  search_queries: searchQueriesSchema,
});
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

const searchResult = z.object({
  content: z.string(),
  title: z.string(),
  url: z.string(),
});

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
