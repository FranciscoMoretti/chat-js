import { tavily } from "@tavily/core";
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

const TAVILY_COST_CENTS = 5;
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const webSearch = defineTool({
  description: `Multi-query web search (supports depth, topic & result limits). Always cite sources inline.

Use for:
- General information gathering via web search

Avoid:
- Pulling content from a single known URL (use retrieveUrl instead)`,
  execute: (
    { search_queries, topics, searchDepth, exclude_domains },
    context
  ) =>
    executeWithResearchProgress(
      context,
      async ({ dataStream, usage, abortSignal }) => {
        const toolCallId = context.callId;
        const writeTopLevelUpdates = true;
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
        const safeTopics = topics ?? ["general"];
        const safeSearchDepth = searchDepth ?? "basic";
        const safeExcludeDomains = exclude_domains ?? [];

        const result = await executeMultiQuerySearch({
          completeTitle: "Search complete",
          dataStream,
          search: async ({ query, maxResults }, index) => {
            if (
              !(
                typeof env.TAVILY_API_KEY === "string" &&
                env.TAVILY_API_KEY !== ""
              )
            ) {
              throw new Error("Set TAVILY_API_KEY to enable Tavily search.");
            }
            const topic = safeTopics[index] ?? safeTopics[0] ?? "general";
            const response = await tavily({
              apiKey: env.TAVILY_API_KEY,
            }).search(query, {
              days: topic === "news" ? 7 : undefined,
              excludeDomains: safeExcludeDomains,
              includeAnswer: true,
              maxResults,
              searchDepth: safeSearchDepth,
              topic,
            });
            return response.results.map(({ title, url, content }) => ({
              content,
              title,
              url,
            }));
          },
          search_queries: search_queries.map((query) => ({
            maxResults: query.maxResults ?? DEFAULT_MAX_RESULTS,
            query: query.query,
          })),
          title: "Searching",
          toolCallId,
          writeTopLevelUpdates,
        });

        // Report API cost
        usage.addCostUsd(TAVILY_COST_CENTS / 100);

        return result;
      }
    ),
  // Keep defaultable fields required and nullable for strict tool calling.
  inputSchema: webSearchInput,
  toModelOutput: toolResultToModelOutput,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
