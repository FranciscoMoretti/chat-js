import FirecrawlApp from "@mendable/firecrawl-js";
import { defineTool } from "eve/tools";

import { env } from "@/lib/env";
import { executeWithResearchProgress } from "@/lib/eve/research-progress";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  DEFAULT_MAX_RESULTS,
  executeMultiQuerySearch,
} from "@/tools/platform/search-presentation";
/* oxlint-enable eslint/sort-imports */

import { webSearchInput } from "./schemas";

const FIRECRAWL_COST_CENTS = 5;
/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
            if (
              !(
                typeof env.FIRECRAWL_API_KEY === "string" &&
                env.FIRECRAWL_API_KEY !== ""
              )
            ) {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
