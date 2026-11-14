import { searchQueriesSchema, searchOutputSchema } from "./search-runtime";
import { z } from "zod";

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

const webSearchResult = searchOutputSchema;
export { webSearchInput, webSearchResult };
