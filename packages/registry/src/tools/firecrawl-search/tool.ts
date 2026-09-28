import FirecrawlApp from "@mendable/firecrawl-js";
import { defineTool } from "eve/tools";

import { env } from "@/lib/env";
import { executeWithResearchProgress } from "@/lib/eve/research-progress";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { createModuleLogger } from "@/lib/logger";
import {
  DEFAULT_MAX_RESULTS,
  executeMultiQuerySearch,
} from "@/tools/platform/search-presentation";

import { webSearchInput } from "./schemas";

const FIRECRAWL_COST_CENTS = 5;
export const webSearch = defineTool({
  description: `Multi-query web search using Firecrawl for enhanced content extraction. Always cite sources inline.

Use for:
- General information gathering via web search with detailed content extraction
- When you need high-quality markdown content from web pages

Avoid:
- Pulling content from a single known URL (use retrieveUrl instead)`,
  execute: ({ search_queries }, context) =>
    executeWithResearchProgress(
      context,
      async ({ dataStream, usage, abortSignal }) => {
        const toolCallId = context.callId;
        const writeTopLevelUpdates = true;
        abortSignal.throwIfAborted();
        const log = createModuleLogger("tools/web-search");
        log.debug({ queriesCount: search_queries.length }, "webSearch.execute");
        const result = await executeMultiQuerySearch({
          completeTitle: "Firecrawl search complete",
          dataStream,
          search: async ({ query, maxResults }) => {
            if (!env.FIRECRAWL_API_KEY) {
              throw new Error(
                "Set FIRECRAWL_API_KEY to enable Firecrawl search."
              );
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
        usage.addCostUsd(FIRECRAWL_COST_CENTS / 100);

        return result;
      }
    ),
  inputSchema: webSearchInput,
  toModelOutput: toolResultToModelOutput,
});
