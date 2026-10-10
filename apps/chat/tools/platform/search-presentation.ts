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
type SearchExecution = Parameters<typeof multiQueryWebSearchStep>[number];
type SearchResponse = Awaited<ReturnType<typeof multiQueryWebSearchStep>>;

const writeSearchLifecycle = (options: {
  readonly dataStream: Readonly<ToolProgressWriter> | undefined;
  readonly enabled: boolean;
  readonly title: string;
  readonly toolCallId: string;
  readonly type: "started" | "completed";
}): void => {
  if (!options.enabled) {
    return;
  }
  // oxlint-disable-next-line oxc/no-optional-chaining -- The app's preferred nullish guard skips timestamps and payload construction without a writer.
  options.dataStream?.write({
    data: {
      timestamp: Date.now(),
      title: options.title,
      toolCallId: options.toolCallId,
      type: options.type,
    },
    type: "data-researchUpdate",
  });
};

const completeSearch = <Searches extends readonly unknown[]>(
  options: {
    readonly completeTitle: string;
    readonly dataStream: Readonly<ToolProgressWriter> | undefined;
    readonly log: Readonly<
      Pick<ReturnType<typeof createModuleLogger>, "debug" | "error">
    >;
    readonly queries: SearchExecution["queries"];
    readonly toolCallId: string;
    readonly writeTopLevelUpdates: boolean;
  },
  { searches, error }: { readonly searches: Searches; readonly error?: string }
): { searches: Searches; error?: string } => {
  const hasError = Boolean(error);
  if (hasError) {
    options.log.error(
      { error, queriesCount: options.queries.length },
      "multiQueryWebSearchStep returned error"
    );
  }
  writeSearchLifecycle({
    dataStream: options.dataStream,
    enabled: options.writeTopLevelUpdates,
    title: options.completeTitle,
    toolCallId: options.toolCallId,
    type: "completed",
  });
  const totalSteps = 1;
  options.log.debug(
    { completedSteps: totalSteps, resultGroups: searches.length, totalSteps },
    "executeMultiQuerySearch complete"
  );
  if (hasError) {
    // oxlint-disable-next-line sort-keys -- Preserve the serialized result order: searches precedes the optional error field.
    return { searches, error };
  }
  return { searches };
};

// Common search execution logic
// oxlint-disable-next-line oxc/no-async-await -- Complete progress and response shaping only after the single awaited search, preserving rejected-Promise behavior.
const executeMultiQuerySearch = async ({
  search_queries,
  search,
  dataStream,
  toolCallId,
  writeTopLevelUpdates,
  title,
  completeTitle,
}: {
  readonly search_queries: SearchExecution["queries"];
  readonly search: SearchExecution["search"];
  readonly dataStream?: Readonly<ToolProgressWriter>;
  readonly toolCallId: string;
  readonly writeTopLevelUpdates: boolean;
  readonly title: string;
  readonly completeTitle: string;
}): Promise<SearchResponse> => {
  const log = createModuleLogger("tools/web-search");
  log.debug(
    { queriesCount: search_queries.length },
    "executeMultiQuerySearch start"
  );
  writeSearchLifecycle({
    dataStream,
    enabled: writeTopLevelUpdates,
    title,
    toolCallId,
    type: "started",
  });
  const response = await multiQueryWebSearchStep({
    dataStream,
    queries: search_queries,
    search,
    toolCallId,
  });
  return completeSearch(
    {
      completeTitle,
      dataStream,
      log,
      queries: search_queries,
      toolCallId,
      writeTopLevelUpdates,
    },
    response
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (DEFAULT_MAX_RESULTS, executeMultiQuerySearch, searchQueriesSchema); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { DEFAULT_MAX_RESULTS, executeMultiQuerySearch, searchQueriesSchema };
/* oxlint-enable import/no-named-export */
