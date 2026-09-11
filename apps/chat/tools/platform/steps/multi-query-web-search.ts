import type { StreamWriter } from "@/lib/ai/types";
import { generateUUID } from "@/lib/utils";
import { deduplicateByDomainAndUrl } from "./search-utils";

export interface SearchQuery {
  maxResults: number;
  query: string;
}

interface MultiQuerySearchResult {
  query: SearchQuery;
  results: Array<{
    url: string;
    title: string;
    content: string;
  }>;
}

export interface MultiQuerySearchResponse {
  error?: string;
  searches: MultiQuerySearchResult[];
}

export async function multiQueryWebSearchStep({
  queries,
  search,
  dataStream,
  toolCallId,
}: {
  queries: SearchQuery[];
  search: (
    query: SearchQuery,
    index: number
  ) => Promise<Array<{ title: string; url: string; content: string }>>;
  dataStream?: StreamWriter;
  toolCallId: string;
}): Promise<MultiQuerySearchResponse> {
  const updateId = generateUUID();
  try {
    // Send initial annotation showing all queries being executed
    dataStream?.write({
      type: "data-researchUpdate",
      id: updateId,
      data: {
        toolCallId,
        title: `Executing ${queries.length} searches`,
        type: "web",
        status: "running",
        queries: queries.map((q) => q.query),
      },
    });

    // Execute searches in parallel
    const searchPromises = queries.map(async (query, index) => {
      const results = await search(query, index);

      return {
        query,
        results: deduplicateByDomainAndUrl(results).map((obj) => ({
          url: obj.url,
          title: obj.title,
          content: obj.content,
        })),
      };
    });

    const searchResults = await Promise.all(searchPromises);

    // Send completion annotation with all results
    const allResults = deduplicateByDomainAndUrl(
      searchResults.flatMap((search) => search.results)
    );
    dataStream?.write({
      type: "data-researchUpdate",
      id: updateId,
      data: {
        toolCallId,
        title: `Executing ${queries.length} searches`,
        type: "web",
        status: "completed",
        queries: queries.map((q) => q.query),
        results: allResults.map((result) => ({
          ...result,
          source: "web",
        })),
      },
    });

    return {
      searches: searchResults,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Send error annotation
    dataStream?.write({
      type: "data-researchUpdate",
      id: updateId,
      data: {
        toolCallId,
        title: `Executing ${queries.length} searches`,
        type: "web",
        status: "completed",
        queries: queries.map((q) => q.query),
      },
    });

    return {
      searches: [],
      error: errorMessage,
    };
  }
}
