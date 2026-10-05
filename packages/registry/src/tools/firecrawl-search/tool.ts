import FirecrawlApp from "@mendable/firecrawl-js";
import { defineTool } from "eve/tools";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolProgressWriter } from "@/lib/ai/tool-context";
/* oxlint-enable sort-imports */
import { env } from "@/lib/env";
import { executeWithResearchProgress } from "@/lib/eve/research-progress";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  DEFAULT_MAX_RESULTS,
  executeMultiQuerySearch,
} from "@/tools/platform/search-presentation";
/* oxlint-enable sort-imports */

import { webSearchInput } from "./schemas";

const FIRECRAWL_COST_CENTS = 5;
const CENTS_PER_USD = 100;
type SearchInput = z.infer<typeof webSearchInput>;
type ReadonlySearchInput = Readonly<{
  search_queries: readonly Readonly<SearchInput["search_queries"][number]>[];
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

const FIRECRAWL_SEARCH_TIMEOUT_MS = 15_000;
const searchFirecrawl = async ({
  query,
  maxResults,
}: Readonly<{ query: string; maxResults: number }>): Promise<
  { content: string; title: string; url: string }[]
> => {
  if (
    !(typeof env.FIRECRAWL_API_KEY === "string" && env.FIRECRAWL_API_KEY !== "")
  ) {
    throw new Error("Set FIRECRAWL_API_KEY to enable Firecrawl search.");
  }
  const response = await new FirecrawlApp({
    apiKey: env.FIRECRAWL_API_KEY,
  }).search(query, {
    limit: maxResults,
    scrapeOptions: { formats: ["markdown"] },
    timeout: FIRECRAWL_SEARCH_TIMEOUT_MS,
  });
  return response.data.map(
    (item: Readonly<{ markdown?: string; title?: string; url?: string }>) => ({
      content: item.markdown ?? "",
      title: item.title ?? "",
      url: item.url ?? "",
    })
  );
};

export const webSearch = defineTool({
  description: `Multi-query web search using Firecrawl for enhanced content extraction. Always cite sources inline.

Use for:
- General information gathering via web search with detailed content extraction
- When you need high-quality markdown content from web pages

Avoid:
- Pulling content from a single known URL (use retrieveUrl instead)`,
  execute: (
    { search_queries }: ReadonlySearchInput,
    context: ExecutionContext
  ) =>
    executeWithResearchProgress(
      context,
      async ({ dataStream, usage, abortSignal }: ResearchExecution) => {
        const toolCallId = context.callId;
        abortSignal.throwIfAborted();
        const log = createModuleLogger("tools/web-search");
        log.debug({ queriesCount: search_queries.length }, "webSearch.execute");
        const result = await executeMultiQuerySearch({
          completeTitle: "Firecrawl search complete",
          dataStream,
          search: searchFirecrawl,
          search_queries: search_queries.map((query) => ({
            maxResults: query.maxResults ?? DEFAULT_MAX_RESULTS,
            query: query.query,
          })),
          title: "Searching with Firecrawl",
          toolCallId,
          writeTopLevelUpdates: true,
        });

        // Report API cost
        usage.addCostUsd(FIRECRAWL_COST_CENTS / CENTS_PER_USD);

        return result;
      }
    ),
  inputSchema: webSearchInput,
  toModelOutput: toolResultToModelOutput,
});
