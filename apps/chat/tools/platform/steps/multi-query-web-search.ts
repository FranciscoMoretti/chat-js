import type { ToolProgressWriter } from "@/lib/ai/tool-context";
import { generateUUID } from "@/lib/utils";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { deduplicateByDomainAndUrl } from "./search-utils";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/consistent-type-definitions -- typescript/consistent-type-definitions (#559): SearchQuery preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
type SearchQuery = {
  maxResults: number;
  query: string;
};
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable typescript/consistent-type-definitions -- typescript/consistent-type-definitions (#559): MultiQuerySearchResult preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
type MultiQuerySearchResult = {
  query: SearchQuery;
  results: {
    url: string;
    title: string;
    content: string;
  }[];
};
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable typescript/consistent-type-definitions -- typescript/consistent-type-definitions (#559): MultiQuerySearchResponse preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
type MultiQuerySearchResponse = {
  error?: string;
  searches: MultiQuerySearchResult[];
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve multiQueryWebSearchStep's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types --
 * max-lines-per-function (#510): multiQueryWebSearchStep keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): multiQueryWebSearchStep keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): multiQueryWebSearchStep accepts { queries, search, dataStream, toolCallId, }: { queries: SearchQuery[]; search: ( qu; query: SearchQuery; query; query; obj; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const multiQueryWebSearchStep = async ({
  queries,
  search,
  dataStream,
  toolCallId,
}: {
  queries: SearchQuery[];
  search: (
    query: SearchQuery,
    index: number
  ) => Promise<{ title: string; url: string; content: string }[]>;
  dataStream?: ToolProgressWriter;
  toolCallId: string;
}): Promise<MultiQuerySearchResponse> => {
  const updateId = generateUUID();
  try {
    // Send initial annotation showing all queries being executed
    dataStream?.write({
      data: {
        queries: queries.map((query) => query.query),
        status: "running",
        title: `Executing ${queries.length} searches`,
        toolCallId,
        type: "web",
      },
      id: updateId,
      type: "data-researchUpdate",
    });

    // Execute searches in parallel
    const searchPromises = queries.map(async (query, index) => {
      const results = await search(query, index);

      return {
        query,
        results: deduplicateByDomainAndUrl(results).map((obj) => ({
          content: obj.content,
          title: obj.title,
          url: obj.url,
        })),
      };
    });

    const searchResults = await Promise.all(searchPromises);

    // Send completion annotation with all results
    const allResults = deduplicateByDomainAndUrl(
      searchResults.flatMap((searchResult) => searchResult.results)
    );
    dataStream?.write({
      data: {
        queries: queries.map((query) => query.query),
        // oxlint-disable-next-line oxc/no-map-spread -- #541: Tag search output without mutating the collected provider results.
        results: allResults.map((result) => ({
          ...result,
          source: "web",
        })),
        status: "completed",
        title: `Executing ${queries.length} searches`,
        toolCallId,
        type: "web",
      },
      id: updateId,
      type: "data-researchUpdate",
    });

    return {
      searches: searchResults,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Send error annotation
    dataStream?.write({
      data: {
        queries: queries.map((query) => query.query),
        status: "completed",
        title: `Executing ${queries.length} searches`,
        toolCallId,
        type: "web",
      },
      id: updateId,
      type: "data-researchUpdate",
    });

    return {
      error: errorMessage,
      searches: [],
    };
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (multiQueryWebSearchStep); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types */
export { multiQueryWebSearchStep };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (MultiQuerySearchResponse, MultiQuerySearchResult, SearchQuery); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { MultiQuerySearchResponse, MultiQuerySearchResult, SearchQuery };
/* oxlint-enable import/no-named-export */
