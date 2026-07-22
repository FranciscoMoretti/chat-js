import type { StreamWriter } from "@/lib/ai/types";
import { generateUUID } from "@/lib/utils";
import { deduplicateByDomainAndUrl } from "./search-utils";
import type { SearchProviderOptions } from "./web-search";
import { webSearchStep } from "./web-search";

export interface SearchQuery {
  maxResults: number;
  query: string;
}

export interface MultiQuerySearchOptions {
  baseProviderOptions: SearchProviderOptions;
  excludeDomains?: string[];
  topics?: string[];
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
  options,
  dataStream,
  toolCallId,
}: {
  queries: SearchQuery[];
  options: MultiQuerySearchOptions;
  dataStream: StreamWriter;
  toolCallId: string;
}): Promise<MultiQuerySearchResponse> {
  const updateId = generateUUID();
  try {
    const { baseProviderOptions, topics = [], excludeDomains = [] } = options;

    // Send initial annotation showing all queries being executed
    dataStream.write({
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
      // Build provider options for this specific query
      let queryProviderOptions: SearchProviderOptions;

      if (baseProviderOptions.provider === "tavily") {
        queryProviderOptions = {
          ...baseProviderOptions,
          topic: topics[index] || topics[0] || "general",
          days: topics[index] === "news" ? 7 : undefined,
          excludeDomains,
        };
      } else if (baseProviderOptions.provider === "firecrawl") {
        queryProviderOptions = {
          ...baseProviderOptions,
        };
      } else if (baseProviderOptions.provider === "serpdive") {
        // SERPdive infers freshness and locale from the query itself, so
        // there is no per-query topic or recency window to forward.
        queryProviderOptions = {
          ...baseProviderOptions,
        };
      } else {
        queryProviderOptions = baseProviderOptions;
      }

      const data = await webSearchStep({
        query: query.query,
        maxResults: query.maxResults,
        providerOptions: queryProviderOptions,
      });

      return {
        query,
        results: deduplicateByDomainAndUrl(data.results).map((obj) => ({
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
    dataStream.write({
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
    dataStream.write({
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
