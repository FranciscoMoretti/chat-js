import { tavily } from "@tavily/core";
import { defineTool, toolOutput } from "eve/tools";
import { readToolEnvironment } from "./tavily-search-env";
import { DEFAULT_MAX_RESULTS, searchSnapshots } from "./search-runtime";
import { webSearchInput, webSearchResult } from "./schemas";
import type { z } from "zod";

type SearchInput = z.infer<typeof webSearchInput>;
const FIRST_TOPIC_INDEX = 0;
const NEWS_LOOKBACK_DAYS = 7;
const createTavilySearch = (
  options: Readonly<{
    topics: Readonly<NonNullable<SearchInput["topics"]>>;
    excludeDomains: readonly string[];
    searchDepth: NonNullable<SearchInput["searchDepth"]>;
  }>
) => {
  const env = readToolEnvironment();
  if (env.TAVILY_API_KEY === undefined || env.TAVILY_API_KEY === "") {
    throw new Error("Set TAVILY_API_KEY to enable Tavily search.");
  }
  const client = tavily({ apiKey: env.TAVILY_API_KEY });
  return async (
    { query, maxResults }: Readonly<{ query: string; maxResults: number }>,
    index: number
  ) => {
    const topic =
      options.topics[index] ?? options.topics[FIRST_TOPIC_INDEX] ?? "general";
    const response = await client.search(query, {
      days: topic === "news" ? NEWS_LOOKBACK_DAYS : undefined,
      excludeDomains: [...options.excludeDomains],
      includeAnswer: true,
      maxResults,
      searchDepth: options.searchDepth,
      topic,
    });
    return response.results.map(
      ({
        title,
        url,
        content,
      }: Readonly<{ title: string; url: string; content: string }>) => ({
        content,
        title,
        url,
      })
    );
  };
};
export const searchUpdates = (output: z.infer<typeof webSearchResult>) =>
  output.updates;

export const webSearch = defineTool({
  description: `Multi-query web search (supports depth, topic & result limits). Always cite sources inline.

Use for:
- General information gathering via web search

Avoid:
- Pulling content from a single known URL (use retrieveUrl instead)`,
  execute: (input: SearchInput, context) =>
    searchSnapshots({
      queries: input.search_queries.map((query) => ({
        query: query.query,
        maxResults: query.maxResults ?? DEFAULT_MAX_RESULTS,
      })),
      search: createTavilySearch({
        excludeDomains: input.exclude_domains ?? [],
        searchDepth: input.searchDepth ?? "basic",
        topics: input.topics ?? ["general"],
      }),
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
