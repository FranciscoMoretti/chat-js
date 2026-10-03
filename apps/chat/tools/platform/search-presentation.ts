import { z } from "zod";

import type { ToolProgressWriter } from "@/lib/ai/tool-context";
import { createModuleLogger } from "@/lib/logger";

import { multiQueryWebSearchStep } from "./steps/multi-query-web-search";

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): DEFAULT_MAX_RESULTS is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): DEFAULT_MAX_RESULTS stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const DEFAULT_MAX_RESULTS = 5;
/* oxlint-enable import/exports-last, import/group-exports */

// Bound the number of parallel searches per tool call.
const MAX_SEARCH_QUERIES = 2;
/* oxlint-disable import/group-exports, no-magic-numbers --
 * import/group-exports (#523): searchQueriesSchema stays exported at its declaration so its public contract is visible beside its implementation.
 * no-magic-numbers (#517): searchQueriesSchema uses 1, 10 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
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
/* oxlint-enable import/group-exports, no-magic-numbers */

/* oxlint-disable import/group-exports, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): executeMultiQuerySearch stays exported at its declaration so its public contract is visible beside its implementation.
 * max-lines-per-function (#510): executeMultiQuerySearch keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): executeMultiQuerySearch keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): executeMultiQuerySearch uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep executeMultiQuerySearch's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep executeMultiQuerySearch's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): executeMultiQuerySearch accepts { search_queries, search, dataStream, toolCallId, writeTopLevelUpdates, title, comple; query: { query: string; maxResults: number }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): executeMultiQuerySearch intentionally keeps the existing falsy-value behavior of error; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
  dataStream?: ToolProgressWriter;
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
/* oxlint-enable import/group-exports, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
