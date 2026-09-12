import { z } from "zod";

import type { StreamWriter } from "@/lib/ai/types";
import { createModuleLogger } from "@/lib/logger";

import { multiQueryWebSearchStep } from "./steps/multi-query-web-search";

export const DEFAULT_MAX_RESULTS = 5;

// Bound the number of parallel searches per tool call.
const MAX_SEARCH_QUERIES = 2;
// Strict tool schemas require every property; null requests the default.
export const searchQueriesSchema = z
  .array(
    z.object({
      maxResults: z
        .number()
        .min(1)
        .max(10)
        .nullable()
        .describe(
          `Maximum number of results for this query. Pass null to use ${DEFAULT_MAX_RESULTS}.`
        ),
      query: z.string(),
    })
  )
  .max(MAX_SEARCH_QUERIES)
  .describe(`Array of search queries. Maximum ${MAX_SEARCH_QUERIES} queries.`);

// Common search execution logic
export const executeMultiQuerySearch = async ({
  search_queries,
  search,
  dataStream,
  toolCallId,
  writeTopLevelUpdates,
  title,
  completeTitle,
}: {
  search_queries: { query: string; maxResults: number }[];
  search: (
    query: { query: string; maxResults: number },
    index: number
  ) => Promise<{ title: string; url: string; content: string }[]>;
  dataStream?: StreamWriter;
  toolCallId: string;
  writeTopLevelUpdates: boolean;
  title: string;
  completeTitle: string;
}) => {
  const log = createModuleLogger("tools/web-search");
  log.debug(
    { queriesCount: search_queries.length },
    "executeMultiQuerySearch start"
  );
  if (writeTopLevelUpdates) {
    dataStream?.write({
      data: {
        timestamp: Date.now(),
        title,
        toolCallId,
        type: "started",
      },
      type: "data-researchUpdate",
    });
  }

  let completedSteps = 0;
  const totalSteps = 1;

  const { searches: searchResults, error } = await multiQueryWebSearchStep({
    dataStream,
    queries: search_queries,
    search,
    toolCallId,
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
      data: {
        timestamp: Date.now(),
        title: completeTitle,
        toolCallId,
        type: "completed",
      },
      type: "data-researchUpdate",
    });
  }
  log.debug(
    { completedSteps, resultGroups: searchResults.length, totalSteps },
    "executeMultiQuerySearch complete"
  );
  return { searches: searchResults, ...(error ? { error } : {}) };
};
