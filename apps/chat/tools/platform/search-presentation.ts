import type { ToolProgressWriter } from "@/lib/ai/tool-context";
import { createModuleLogger } from "@/lib/logger";
import { multiQueryWebSearchStep } from "./steps/multi-query-web-search";
import { z } from "zod";

const DEFAULT_MAX_RESULTS = 5;
const MIN_RESULTS_PER_QUERY = 1;
const MAX_RESULTS_PER_QUERY = 10;

// Bound the number of parallel searches per tool call.
const MAX_SEARCH_QUERIES = 2;
// Strict tool schemas require every property; null requests the default.
const searchQueriesSchema = z
  .array(
    z.object({
      maxResults: z
        .number()
        .min(MIN_RESULTS_PER_QUERY)
        .max(MAX_RESULTS_PER_QUERY)
        .nullable()
        .describe(
          `Maximum number of results for this query. Pass null to use ${DEFAULT_MAX_RESULTS}.`
        ),
      query: z.string(),
    })
  )
  .max(MAX_SEARCH_QUERIES)
  .describe(`Array of search queries. Maximum ${MAX_SEARCH_QUERIES} queries.`);
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeMultiQuerySearch's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-lines-per-function, max-statements -- This operation sequences start/search/completion progress writes and logging; keep failure and callback ordering together. */

// Common search execution logic
const executeMultiQuerySearch = async ({
  search_queries,
  search,
  dataStream,
  toolCallId,
  writeTopLevelUpdates,
  title,
  completeTitle,
}: {
  readonly search_queries: readonly {
    readonly query: string;
    readonly maxResults: number;
  }[];
  readonly search: (
    query: { readonly query: string; readonly maxResults: number },
    index: number
  ) => Promise<
    { readonly title: string; readonly url: string; readonly content: string }[]
  >;
  readonly dataStream?: Readonly<ToolProgressWriter>;
  readonly toolCallId: string;
  readonly writeTopLevelUpdates: boolean;
  readonly title: string;
  readonly completeTitle: string;
}): Promise<Awaited<ReturnType<typeof multiQueryWebSearchStep>>> => {
  const log = createModuleLogger("tools/web-search");
  log.debug(
    { queriesCount: search_queries.length },
    "executeMultiQuerySearch start"
  );
  if (writeTopLevelUpdates) {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading write from dataStream; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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

  const totalSteps = 1;

  const { searches: searchResults, error } = await multiQueryWebSearchStep({
    dataStream,
    queries: search_queries,
    search,
    toolCallId,
  });
  const hasError = Boolean(error);
  if (hasError) {
    log.error(
      { error, queriesCount: search_queries.length },
      "multiQueryWebSearchStep returned error"
    );
  }

  if (writeTopLevelUpdates) {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading write from dataStream; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    {
      completedSteps: totalSteps,
      resultGroups: searchResults.length,
      totalSteps,
    },
    "executeMultiQuerySearch complete"
  );
  if (hasError) {
    // oxlint-disable-next-line sort-keys -- Preserve the serialized result order: searches precedes the optional error field.
    return { searches: searchResults, error };
  }
  return { searches: searchResults };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (DEFAULT_MAX_RESULTS, executeMultiQuerySearch, searchQueriesSchema); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements */
export { DEFAULT_MAX_RESULTS, executeMultiQuerySearch, searchQueriesSchema };
/* oxlint-enable import/no-named-export */
