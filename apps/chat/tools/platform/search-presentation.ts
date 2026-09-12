import { z } from "zod";

import type { StreamWriter } from "@/lib/ai/types";
import { createModuleLogger } from "@/lib/logger";

import { multiQueryWebSearchStep } from "./steps/multi-query-web-search";

export const DEFAULT_MAX_RESULTS = 5;

const MAX_SEARCH_QUERIES = 2; // Bound the number of parallel searches per tool call
// Strict tool schemas require every property; null requests the default.
export const searchQueriesSchema = z
  .array(
    z.object({
      query: z.string(),
      maxResults: z
        .number()
        .min(1)
        .max(10)
        .nullable()
        .describe(
          `Maximum number of results for this query. Pass null to use ${DEFAULT_MAX_RESULTS}.`
        ),
    })
  )
  .max(MAX_SEARCH_QUERIES)
  .describe(`Array of search queries. Maximum ${MAX_SEARCH_QUERIES} queries.`);

// Common search execution logic
export async function executeMultiQuerySearch({
  search_queries,
  search,
  dataStream,
  toolCallId,
  writeTopLevelUpdates,
  title,
  completeTitle,
}: {
  search_queries: Array<{ query: string; maxResults: number }>;
  search: (
    query: { query: string; maxResults: number },
    index: number
  ) => Promise<Array<{ title: string; url: string; content: string }>>;
  dataStream?: StreamWriter;
  toolCallId: string;
  writeTopLevelUpdates: boolean;
  title: string;
  completeTitle: string;
}) {
  const log = createModuleLogger("tools/web-search");
  log.debug(
    { queriesCount: search_queries.length },
    "executeMultiQuerySearch start"
  );
  if (writeTopLevelUpdates) {
    dataStream?.write({
      type: "data-researchUpdate",
      data: {
        toolCallId,
        title,
        timestamp: Date.now(),
        type: "started",
      },
    });
  }

  let completedSteps = 0;
  const totalSteps = 1;

  const { searches: searchResults, error } = await multiQueryWebSearchStep({
    queries: search_queries,
    search,
    toolCallId,
    dataStream,
  });
  if (error) {
    log.error(
      { error, queriesCount: search_queries.length },
      "multiQueryWebSearchStep returned error"
    );
  }

  completedSteps += 1;
  if (writeTopLevelUpdates) {
    dataStream?.write({
      type: "data-researchUpdate",
      data: {
        toolCallId,
        title: completeTitle,
        timestamp: Date.now(),
        type: "completed",
      },
    });
  }
  log.debug(
    { completedSteps, totalSteps, resultGroups: searchResults.length },
    "executeMultiQuerySearch complete"
  );
  return { searches: searchResults, ...(error ? { error } : {}) };
}
