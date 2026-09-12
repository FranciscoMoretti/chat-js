import type { StreamWriter } from "@/lib/ai/types";
import { generateUUID } from "@/lib/utils";

import { deduplicateByDomainAndUrl } from "./search-utils";

export interface SearchQuery {
  maxResults: number;
  query: string;
}

interface MultiQuerySearchResult {
  query: SearchQuery;
  results: {
    url: string;
    title: string;
    content: string;
  }[];
}

export interface MultiQuerySearchResponse {
  error?: string;
  searches: MultiQuerySearchResult[];
}

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
  dataStream?: StreamWriter;
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
