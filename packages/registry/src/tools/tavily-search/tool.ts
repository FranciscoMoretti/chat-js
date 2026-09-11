import { tavily } from "@tavily/core";
import { type ToolExecutionOptions, tool } from "ai";
import { z } from "zod";
import type { ChatToolContext } from "@/lib/ai/tool-context";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";
import {
  DEFAULT_MAX_RESULTS,
  executeMultiQuerySearch,
  searchQueriesSchema,
} from "@/tools/platform/search-presentation";

const TAVILY_COST_CENTS = 5;
export const webSearch = tool({
  description: `Multi-query web search (supports depth, topic & result limits). Always cite sources inline.

Use for:
- General information gathering via web search

Avoid:
- Pulling content from a single known URL (use retrieveUrl instead)`,
  // Keep defaultable fields required and nullable for strict tool calling.
  inputSchema: z.object({
    search_queries: searchQueriesSchema,
    topics: z
      .array(z.enum(["general", "news"]))
      .describe(
        "Array of topic types to search for. Pass null for general search."
      )
      .nullable(),
    searchDepth: z
      .enum(["basic", "advanced"])
      .describe('Search depth to use. Pass null for "basic".')
      .nullable(),
    exclude_domains: z
      .array(z.string())
      .describe(
        "Domains to exclude from all results. Pass null for no exclusions."
      )
      .nullable(),
  }),
  execute: async (
    {
      search_queries,
      topics,
      searchDepth,
      exclude_domains,
    }: {
      search_queries: { query: string; maxResults: number | null }[];
      topics: ("general" | "news")[] | null;
      searchDepth: "basic" | "advanced" | null;
      exclude_domains: string[] | null;
    },
    {
      toolCallId: sdkToolCallId,
      context,
    }: ToolExecutionOptions<ChatToolContext>
  ) => {
    const {
      dataStream,
      costAccumulator,
      toolCallIdOverride,
      writeTopLevelUpdates = true,
    } = context ?? {};
    const toolCallId = toolCallIdOverride ?? sdkToolCallId;
    const log = createModuleLogger("tools/web-search");
    log.debug(
      {
        queriesCount: search_queries.length,
        topics,
        searchDepth,
        exclude_domains,
      },
      "webSearch.execute"
    );
    // Handle nullable arrays with defaults
    const safeTopics = topics ?? ["general"];
    const safeSearchDepth = searchDepth ?? "basic";
    const safeExcludeDomains = exclude_domains ?? [];

    const result = await executeMultiQuerySearch({
      search_queries: search_queries.map((query) => ({
        query: query.query,
        maxResults: query.maxResults ?? DEFAULT_MAX_RESULTS,
      })),
      search: async ({ query, maxResults }, index) => {
        if (!env.TAVILY_API_KEY) {
          throw new Error("Set TAVILY_API_KEY to enable Tavily search.");
        }
        const topic = safeTopics[index] ?? safeTopics[0] ?? "general";
        const response = await tavily({ apiKey: env.TAVILY_API_KEY }).search(
          query,
          {
            maxResults,
            searchDepth: safeSearchDepth,
            topic,
            days: topic === "news" ? 7 : undefined,
            excludeDomains: safeExcludeDomains,
            includeAnswer: true,
          }
        );
        return response.results.map(({ title, url, content }) => ({
          title,
          url,
          content,
        }));
      },
      dataStream,
      toolCallId,
      writeTopLevelUpdates,
      title: "Searching",
      completeTitle: "Search complete",
    });

    // Report API cost
    costAccumulator?.addAPICost("webSearch", TAVILY_COST_CENTS);

    return result;
  },
});
