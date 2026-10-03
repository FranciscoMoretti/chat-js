import type { ToolProgressWriter } from "@/lib/ai/tool-context";
import { generateUUID } from "@/lib/utils";

import { deduplicateByDomainAndUrl } from "./search-utils";

/* oxlint-disable import/group-exports, typescript/consistent-type-definitions --
 * import/group-exports (#523): SearchQuery stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/consistent-type-definitions (#559): SearchQuery preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type SearchQuery = {
  maxResults: number;
  query: string;
};
/* oxlint-enable import/group-exports, typescript/consistent-type-definitions */

/* oxlint-disable import/group-exports, typescript/consistent-type-definitions --
 * import/group-exports (#523): MultiQuerySearchResult stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/consistent-type-definitions (#559): MultiQuerySearchResult preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type MultiQuerySearchResult = {
  query: SearchQuery;
  results: {
    url: string;
    title: string;
    content: string;
  }[];
};
/* oxlint-enable import/group-exports, typescript/consistent-type-definitions */

/* oxlint-disable import/group-exports, typescript/consistent-type-definitions --
 * import/group-exports (#523): MultiQuerySearchResponse stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/consistent-type-definitions (#559): MultiQuerySearchResponse preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type MultiQuerySearchResponse = {
  error?: string;
  searches: MultiQuerySearchResult[];
};
/* oxlint-enable import/group-exports, typescript/consistent-type-definitions */

/* oxlint-disable id-length, max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types --
 * id-length (#506): multiQueryWebSearchStep uses q as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-lines-per-function (#510): multiQueryWebSearchStep keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): multiQueryWebSearchStep keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): multiQueryWebSearchStep accepts { queries, search, dataStream, toolCallId, }: { queries: SearchQuery[]; search: ( qu; query: SearchQuery; q; query; obj; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const multiQueryWebSearchStep = async ({
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
        queries: queries.map((q) => q.query),
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
        queries: queries.map((q) => q.query),
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
        queries: queries.map((q) => q.query),
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
/* oxlint-enable id-length, max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types */
