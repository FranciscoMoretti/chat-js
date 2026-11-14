import FirecrawlApp from "@mendable/firecrawl-js";
import { defineTool, toolOutput } from "eve/tools";
import { readToolEnvironment } from "./firecrawl-search-env";
import { DEFAULT_MAX_RESULTS, searchSnapshots } from "./search-runtime";
import { webSearchInput, webSearchResult } from "./schemas";
import type { z } from "zod";

type SearchInput = z.infer<typeof webSearchInput>;
const FIRECRAWL_SEARCH_TIMEOUT_MS = 15_000;
const createFirecrawlSearch = () => {
  const env = readToolEnvironment();
  if (
    !(typeof env.FIRECRAWL_API_KEY === "string" && env.FIRECRAWL_API_KEY !== "")
  ) {
    throw new Error("Set FIRECRAWL_API_KEY to enable Firecrawl search.");
  }
  const client = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });
  return async ({
    query,
    maxResults,
  }: Readonly<{ query: string; maxResults: number }>) => {
    const response = await client.search(query, {
      limit: maxResults,
      scrapeOptions: { formats: ["markdown"] },
      timeout: FIRECRAWL_SEARCH_TIMEOUT_MS,
    });
    return response.data.map(
      (
        item: Readonly<{ markdown?: string; title?: string; url?: string }>
      ) => ({
        content: item.markdown ?? "",
        title: item.title ?? "",
        url: item.url ?? "",
      })
    );
  };
};
export const searchUpdates = (output: z.infer<typeof webSearchResult>) =>
  output.updates;

export const webSearch = defineTool({
  description: `Multi-query web search using Firecrawl for enhanced content extraction. Always cite sources inline.

Use for:
- General information gathering via web search with detailed content extraction
- When you need high-quality markdown content from web pages

Avoid:
- Pulling content from a single known URL (use retrieveUrl instead)`,
  execute: (input: SearchInput, context) =>
    searchSnapshots({
      queries: input.search_queries.map((query) => ({
        query: query.query,
        maxResults: query.maxResults ?? DEFAULT_MAX_RESULTS,
      })),
      search: createFirecrawlSearch(),
      abortSignal: context.abortSignal,
      callId: context.callId,
      title: "Searching",
      completeTitle: "Search complete",
    }),
  inputSchema: webSearchInput,
  outputSchema: webSearchResult,
  toModelOutput: ({ searches, error }) =>
    toolOutput.json({ searches, ...(error === undefined ? {} : { error }) }),
});
