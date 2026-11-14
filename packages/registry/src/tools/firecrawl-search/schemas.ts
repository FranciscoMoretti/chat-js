import { searchQueriesSchema, searchOutputSchema } from "./search-runtime";
import { z } from "zod";

const webSearchInput = z.object({
  search_queries: searchQueriesSchema,
});

const webSearchResult = searchOutputSchema;
export { webSearchInput, webSearchResult };
