import { tavily } from "@tavily/core";
import { defineTool } from "eve/tools";
import type { z } from "zod";

import type { ToolProgressWriter } from "@/lib/ai/tool-context";
import { env } from "@/lib/env";
import { executeWithResearchProgress } from "@/lib/eve/research-progress";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { createModuleLogger } from "@/lib/logger";
import {
  DEFAULT_MAX_RESULTS,
  executeMultiQuerySearch,
} from "@/tools/platform/search-presentation";

import { webSearchInput } from "./schemas";

const TAVILY_COST_CENTS = 5;
const CENTS_PER_USD = 100;
type SearchInput = z.infer<typeof webSearchInput>;
type ReadonlySearchInput = Readonly<{
  search_queries: readonly Readonly<SearchInput["search_queries"][number]>[];
  exclude_domains: Readonly<SearchInput["exclude_domains"]>;
  searchDepth: SearchInput["searchDepth"];
  topics: Readonly<SearchInput["topics"]>;
}>;
type ExecutionContext = Readonly<{
  abortSignal: Readonly<AbortSignal>;
  callId: string;
}>;
type ResearchExecution = Readonly<{
  abortSignal: Readonly<AbortSignal>;
  dataStream: Readonly<ToolProgressWriter>;
  usage: Readonly<{ addCostUsd: (cost: number) => void }>;
}>;

const FIRST_TOPIC_INDEX = 0;
const NEWS_LOOKBACK_DAYS = 7;
const createTavilySearch =
  (
    options: Readonly<{
      topics: Readonly<NonNullable<SearchInput["topics"]>>;
      excludeDomains: readonly string[];
      searchDepth: NonNullable<SearchInput["searchDepth"]>;
    }>
  ): ((
    query: Readonly<{ query: string; maxResults: number }>,
    index: number
  ) => Promise<{ content: string; title: string; url: string }[]>) =>
  async ({ query, maxResults }, index) => {
    if (
      !(typeof env.TAVILY_API_KEY === "string" && env.TAVILY_API_KEY !== "")
    ) {
      throw new Error("Set TAVILY_API_KEY to enable Tavily search.");
    }
    const topic =
      options.topics[index] ?? options.topics[FIRST_TOPIC_INDEX] ?? "general";
    const response = await tavily({ apiKey: env.TAVILY_API_KEY }).search(
      query,
      {
        // oxlint-disable-next-line eslint/no-undefined -- Tavily merges default days=3 before caller options; the own undefined days value overrides that default so general-search JSON omits days.
        days: topic === "news" ? NEWS_LOOKBACK_DAYS : undefined,
        excludeDomains: [...options.excludeDomains],
        includeAnswer: true,
        maxResults,
        searchDepth: options.searchDepth,
        topic,
      }
    );
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

export const webSearch = defineTool({
  description: `Multi-query web search (supports depth, topic & result limits). Always cite sources inline.

Use for:
- General information gathering via web search

Avoid:
- Pulling content from a single known URL (use retrieveUrl instead)`,
  execute: (
    {
      search_queries,
      topics,
      searchDepth,
      exclude_domains,
    }: ReadonlySearchInput,
    context: ExecutionContext
  ) =>
    executeWithResearchProgress(
      context,
      async ({ dataStream, usage, abortSignal }: ResearchExecution) => {
        const toolCallId = context.callId;
        abortSignal.throwIfAborted();
        const log = createModuleLogger("tools/web-search");
        log.debug(
          {
            exclude_domains,
            queriesCount: search_queries.length,
            searchDepth,
            topics,
          },
          "webSearch.execute"
        );
        // Handle nullable arrays with defaults
        const safeTopics: Readonly<NonNullable<SearchInput["topics"]>> =
          topics ?? ["general"];
        const safeSearchDepth = searchDepth ?? "basic";
        const safeExcludeDomains = exclude_domains ?? [];
        const result = await executeMultiQuerySearch({
          completeTitle: "Search complete",
          dataStream,
          search: createTavilySearch({
            excludeDomains: safeExcludeDomains,
            searchDepth: safeSearchDepth,
            topics: safeTopics,
          }),
          search_queries: search_queries.map((query) => ({
            maxResults: query.maxResults ?? DEFAULT_MAX_RESULTS,
            query: query.query,
          })),
          title: "Searching",
          toolCallId,
          writeTopLevelUpdates: true,
        });

        // Report API cost
        usage.addCostUsd(TAVILY_COST_CENTS / CENTS_PER_USD);

        return result;
      }
    ),
  // Keep defaultable fields required and nullable for strict tool calling.
  inputSchema: webSearchInput,
  toModelOutput: toolResultToModelOutput,
});
