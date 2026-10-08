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
type SearchProvider = (
  query: SearchQuery,
  index: number
) => Promise<Readonly<MultiQuerySearchResult["results"][number]>[]>;

const writeSearchStatus = ({
  dataStream,
  queries,
  status,
  toolCallId,
  updateId,
}: {
  readonly dataStream: Readonly<ToolProgressWriter> | undefined;
  readonly queries: readonly SearchQuery[];
  readonly status: "running" | "completed";
  readonly toolCallId: string;
  readonly updateId: string;
}): void => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Skip query getters and payload construction when no writer is installed, using the app's preferred nullish guard.
  dataStream?.write({
    data: {
      queries: queries.map((query) => query.query),
      status,
      title: `Executing ${queries.length} searches`,
      toolCallId,
      type: "web",
    },
    id: updateId,
    type: "data-researchUpdate",
  });
};

const createSearchTasks = (
  queries: readonly SearchQuery[],
  search: SearchProvider
): Promise<MultiQuerySearchResult>[] =>
  // oxlint-disable-next-line oxc/no-async-await -- Each provider result is normalized after its own await; Promise.all in the caller retains concurrent launch and ordered aggregation.
  queries.map(async (query, index) => {
    const results = await search(query, index);
    return {
      query,
      results: deduplicateByDomainAndUrl(results).map((result) => ({
        content: result.content,
        title: result.title,
        url: result.url,
      })),
    };
  });

const writeSearchResults = ({
  dataStream,
  queries,
  searchResults,
  toolCallId,
  updateId,
}: {
  readonly dataStream: Readonly<ToolProgressWriter> | undefined;
  readonly queries: readonly SearchQuery[];
  readonly searchResults: readonly Readonly<{
    results: readonly Readonly<MultiQuerySearchResult["results"][number]>[];
  }>[];
  readonly toolCallId: string;
  readonly updateId: string;
}): void => {
  const allResults = deduplicateByDomainAndUrl(
    searchResults.flatMap((searchResult) => searchResult.results)
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve unconditional cross-query deduplication above and skip only the final payload when the writer is absent.
  dataStream?.write({
    data: {
      queries: queries.map((query) => query.query),
      // oxlint-disable-next-line sort-keys -- Preserve the original serialized progress-result order, with source following content/title/url.
      results: allResults.map((result) => ({
        content: result.content,
        title: result.title,
        url: result.url,
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
};

// oxlint-disable-next-line oxc/no-async-await -- The shared catch owns provider and progress-writer failures after awaited concurrent aggregation.
const multiQueryWebSearchStep = async ({
  queries,
  search,
  dataStream,
  toolCallId,
}: {
  readonly queries: readonly SearchQuery[];
  readonly search: SearchProvider;
  readonly dataStream?: Readonly<ToolProgressWriter>;
  readonly toolCallId: string;
}): Promise<MultiQuerySearchResponse> => {
  const updateId = generateUUID();
  try {
    writeSearchStatus({
      dataStream,
      queries,
      status: "running",
      toolCallId,
      updateId,
    });
    const searchTasks = createSearchTasks(queries, search);
    const searchResults = await Promise.all(searchTasks);
    writeSearchResults({
      dataStream,
      queries,
      searchResults,
      toolCallId,
      updateId,
    });
    return { searches: searchResults };
  } catch (error: unknown) {
    const errorMessage =
      // oxlint-disable-next-line no-ternary -- Preserve the lazy Error.message/fallback selection; the pinned prefer-ternary rule rejects equivalent if/else assignments.
      error instanceof Error ? error.message : "Unknown error occurred";
    writeSearchStatus({
      dataStream,
      queries,
      status: "completed",
      toolCallId,
      updateId,
    });
    return { error: errorMessage, searches: [] };
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (multiQueryWebSearchStep); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { multiQueryWebSearchStep };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (MultiQuerySearchResponse, MultiQuerySearchResult, SearchQuery); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { MultiQuerySearchResponse, MultiQuerySearchResult, SearchQuery };
/* oxlint-enable import/no-named-export */
