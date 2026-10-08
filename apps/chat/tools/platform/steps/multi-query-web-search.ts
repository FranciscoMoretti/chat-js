import type { ToolProgressWriter } from "@/lib/ai/tool-context";
import { deduplicateByDomainAndUrl } from "./search-utils";
import { generateUUID } from "@/lib/utils";

/* oxlint-disable typescript/consistent-type-definitions -- Search tool results cross the recursive ToolOutput JSON index-signature boundary; an interface loses implicit index-signature compatibility (native TS2345 in Registry search callers). */
type SearchQuery = {
  readonly maxResults: number;
  readonly query: string;
};
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable typescript/consistent-type-definitions -- Search tool results cross the recursive ToolOutput JSON index-signature boundary; an interface loses implicit index-signature compatibility (native TS2345 in Registry search callers). */
type MultiQuerySearchResult = {
  query: SearchQuery;
  results: {
    url: string;
    title: string;
    content: string;
  }[];
};
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable typescript/consistent-type-definitions -- Search tool results cross the recursive ToolOutput JSON index-signature boundary; an interface loses implicit index-signature compatibility (native TS2345 in Registry search callers). */
type MultiQuerySearchResponse = {
  error?: string;
  searches: MultiQuerySearchResult[];
};
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve multiQueryWebSearchStep's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-lines-per-function, max-statements -- The shared try/catch owns running/completed writes, concurrent searches, and failure progress under one update ID; moving writes outside it changes callback-error handling. */

const multiQueryWebSearchStep = async ({
  queries,
  search,
  dataStream,
  toolCallId,
}: {
  readonly queries: readonly SearchQuery[];
  readonly search: (
    query: SearchQuery,
    index: number
  ) => Promise<
    { readonly title: string; readonly url: string; readonly content: string }[]
  >;
  readonly dataStream?: Readonly<ToolProgressWriter>;
  readonly toolCallId: string;
}): Promise<MultiQuerySearchResponse> => {
  const updateId = generateUUID();
  try {
    // Send initial annotation showing all queries being executed
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading write from dataStream; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    dataStream?.write({
      data: {
        queries: queries.map(
          (query: Readonly<Pick<SearchQuery, "query">>) => query.query
        ),
        status: "running",
        title: `Executing ${queries.length} searches`,
        toolCallId,
        type: "web",
      },
      id: updateId,
      type: "data-researchUpdate",
    });

    // Execute searches in parallel
    const searchPromises = queries.map(async (query: SearchQuery, index) => {
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
      searchResults.flatMap(
        (
          searchResult: Readonly<{
            results: readonly Readonly<{
              title: string;
              url: string;
              content: string;
            }>[];
          }>
        ) => searchResult.results
      )
    );
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading write from dataStream; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    dataStream?.write({
      data: {
        queries: queries.map(
          (query: Readonly<Pick<SearchQuery, "query">>) => query.query
        ),
        results: allResults.map(
          (
            result: Readonly<{ content: string; title: string; url: string }>
            // oxlint-disable-next-line sort-keys -- Keep the original serialized progress-result order, adding source after content/title/url.
          ) => ({
            content: result.content,
            title: result.title,
            url: result.url,
            source: "web",
          })
        ),
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
      // oxlint-disable-next-line no-ternary -- Keep errorMessage as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      error instanceof Error ? error.message : "Unknown error occurred";

    // Send error annotation
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading write from dataStream; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    dataStream?.write({
      data: {
        queries: queries.map(
          (query: Readonly<Pick<SearchQuery, "query">>) => query.query
        ),
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
/* oxlint-enable max-lines-per-function, max-statements */
export { multiQueryWebSearchStep };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (MultiQuerySearchResponse, MultiQuerySearchResult, SearchQuery); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { MultiQuerySearchResponse, MultiQuerySearchResult, SearchQuery };
/* oxlint-enable import/no-named-export */
