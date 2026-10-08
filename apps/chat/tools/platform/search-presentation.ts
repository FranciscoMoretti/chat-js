import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolProgressWriter } from "@/lib/ai/tool-context";
/* oxlint-enable sort-imports */
import { createModuleLogger } from "@/lib/logger";

import { multiQueryWebSearchStep } from "./steps/multi-query-web-search";

const DEFAULT_MAX_RESULTS = 5;

// Bound the number of parallel searches per tool call.
const MAX_SEARCH_QUERIES = 2;
/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): searchQueriesSchema uses 1, 10 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
// Strict tool schemas require every property; null requests the default.
const searchQueriesSchema = z
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeMultiQuerySearch's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions -- max-lines-per-function (#510): executeMultiQuerySearch keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): executeMultiQuerySearch keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): executeMultiQuerySearch uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep executeMultiQuerySearch's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep executeMultiQuerySearch's return type inferred from its schema, SDK, or implementation result; query: { query: string; maxResults: number }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): executeMultiQuerySearch intentionally keeps the existing falsy-value behavior of error; distinguishing empty, zero, and absent states requires a domain behavior decision. */

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
}) => {
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
    { completedSteps, resultGroups: searchResults.length, totalSteps },
    "executeMultiQuerySearch complete"
  );
  // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- Conditional spread (error ? { error } : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  return { searches: searchResults, ...(error ? { error } : {}) };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (DEFAULT_MAX_RESULTS, executeMultiQuerySearch, searchQueriesSchema); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
export { DEFAULT_MAX_RESULTS, executeMultiQuerySearch, searchQueriesSchema };
/* oxlint-enable import/no-named-export */
