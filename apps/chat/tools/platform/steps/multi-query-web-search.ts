import type { ToolProgressWriter } from "@/lib/ai/tool-context";
import type { SearchResultItem } from "../research-updates-schema";
import { deduplicateByDomainAndUrl } from "./search-utils";
import { generateUUID } from "@/lib/utils";

/* oxlint-disable typescript/consistent-type-definitions -- Search tool results cross the recursive ToolOutput JSON index-signature boundary; an interface loses implicit index-signature compatibility (native TS2345 in Registry search callers). */
type SearchQuery = {
  readonly maxResults: number;
  readonly query: string;
};
/* oxlint-enable typescript/consistent-type-definitions */

type MultiQuerySearchResult = Awaited<
  ReturnType<typeof createSearchTasks>[number]
>;

/* oxlint-disable typescript/consistent-type-definitions -- Search tool results cross the recursive ToolOutput JSON index-signature boundary; an interface loses implicit index-signature compatibility (native TS2345 in Registry search callers). */
type MultiQuerySearchResponse = {
  error?: string;
  searches: MultiQuerySearchResult[];
};
/* oxlint-enable typescript/consistent-type-definitions */
type SearchProvider = (
  query: SearchQuery,
  index: number
) => Promise<Readonly<Pick<SearchResultItem, "url" | "title" | "content">>[]>;

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
) =>
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
  dataStream?.write({
    data: {
      queries: queries.map((query) => query.query),
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
export { multiQueryWebSearchStep };
export type { MultiQuerySearchResponse, MultiQuerySearchResult, SearchQuery };
