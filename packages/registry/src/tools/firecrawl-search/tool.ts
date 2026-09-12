import FirecrawlApp from "@mendable/firecrawl-js";
import { tool } from "ai";
import type { ToolExecutionOptions } from "ai";
import { z } from "zod";

import type { ChatToolContext } from "@/lib/ai/tool-context";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";
import {
  DEFAULT_MAX_RESULTS,
  searchQueriesSchema,
  executeMultiQuerySearch,
} from "@/tools/platform/search-presentation";

const FIRECRAWL_COST_CENTS = 5;
export const webSearch = tool({
  description: `Multi-query web search using Firecrawl for enhanced content extraction. Always cite sources inline.

Use for:
- General information gathering via web search with detailed content extraction
- When you need high-quality markdown content from web pages

Avoid:
- Pulling content from a single known URL (use retrieveUrl instead)`,
  execute: async (
    {
      search_queries,
    }: {
      search_queries: { query: string; maxResults: number | null }[];
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
    log.debug({ queriesCount: search_queries.length }, "webSearch.execute");
    const result = await executeMultiQuerySearch({
      completeTitle: "Firecrawl search complete",
      dataStream,
      search: async ({ query, maxResults }) => {
        if (!env.FIRECRAWL_API_KEY) {
          throw new Error("Set FIRECRAWL_API_KEY to enable Firecrawl search.");
        }
        const response = await new FirecrawlApp({
          apiKey: env.FIRECRAWL_API_KEY,
        }).search(query, {
          limit: maxResults,
          scrapeOptions: { formats: ["markdown"] },
          timeout: 15_000,
        });
        return response.data.map((item) => ({
          content: item.markdown ?? "",
          title: item.title ?? "",
          url: item.url ?? "",
        }));
      },
      search_queries: search_queries.map((query) => ({
        maxResults: query.maxResults ?? DEFAULT_MAX_RESULTS,
        query: query.query,
      })),
      title: "Searching with Firecrawl",
      toolCallId,
      writeTopLevelUpdates,
    });

    // Report API cost
    costAccumulator?.addAPICost("webSearch", FIRECRAWL_COST_CENTS);

    return result;
  },
  inputSchema: z.object({
    search_queries: searchQueriesSchema,
  }),
});
