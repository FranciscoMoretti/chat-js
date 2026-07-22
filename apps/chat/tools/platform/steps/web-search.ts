import FirecrawlApp, { type SearchParams } from "@mendable/firecrawl-js";
import { type TavilySearchOptions, tavily } from "@tavily/core";
import { SerpDive, type SearchOptions as SerpDiveSearchOptions } from "serpdive";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";

export type SearchProviderOptions =
  | ({
      provider: "tavily";
    } & Omit<TavilySearchOptions, "limit">)
  | ({
      provider: "firecrawl";
    } & SearchParams)
  | ({
      provider: "serpdive";
    } & Omit<SerpDiveSearchOptions, "maxResults">);

export interface WebSearchResult {
  content: string;
  source: "web";
  title: string;
  url: string;
}

export interface WebSearchResponse {
  error?: string;
  results: WebSearchResult[];
}

// Initialize search providers lazily to avoid runtime errors when keys are missing
const tvly = env.TAVILY_API_KEY ? tavily({ apiKey: env.TAVILY_API_KEY }) : null;
const firecrawl = env.FIRECRAWL_API_KEY
  ? new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY })
  : null;
const serpdive = env.SERPDIVE_API_KEY
  ? new SerpDive({ apiKey: env.SERPDIVE_API_KEY })
  : null;

const log = createModuleLogger("tools/steps/web-search");

function extractErrorInfo(error: unknown): {
  message: string | undefined;
  stack: string | undefined;
  status: number | undefined;
  data: unknown;
} {
  let message: string | undefined;
  let stack: string | undefined;
  let status: number | undefined;
  let data: unknown;

  if (typeof error === "object" && error !== null) {
    if (
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
    ) {
      message = (error as { message: string }).message;
    }
    if (
      "stack" in error &&
      typeof (error as { stack: unknown }).stack === "string"
    ) {
      stack = (error as { stack: string }).stack;
    }
    const maybeResp = (
      error as { response?: { status?: number; data?: unknown } }
    ).response;
    if (maybeResp) {
      status = maybeResp.status;
      data = maybeResp.data;
    }
  }

  return { message, stack, status, data };
}

export async function webSearchStep({
  query,
  maxResults,
  providerOptions,
}: {
  query: string;
  maxResults: number;
  providerOptions: SearchProviderOptions;
}): Promise<WebSearchResponse> {
  try {
    let results: WebSearchResult[] = [];

    if (providerOptions.provider === "tavily") {
      if (!tvly) {
        return {
          results: [],
          error:
            "Tavily is not configured. Set TAVILY_API_KEY or choose a different provider.",
        };
      }
      const response = await tvly.search(query, {
        searchDepth: providerOptions.searchDepth || "basic",
        maxResults,
        includeAnswer: true,
        ...providerOptions,
      });

      results = response.results.map((r) => ({
        source: "web",
        title: r.title,
        url: r.url,
        content: r.content,
      }));
    } else if (providerOptions.provider === "firecrawl") {
      if (!firecrawl) {
        return {
          results: [],
          error:
            "Firecrawl is not configured. Set FIRECRAWL_API_KEY or choose a different provider.",
        };
      }
      const response = await firecrawl.search(query, {
        timeout: providerOptions.timeout || 15_000,
        limit: maxResults,
        scrapeOptions: { formats: ["markdown"] },
        ...providerOptions,
      });

      results = response.data.map((item) => ({
        source: "web",
        title: item.title || "",
        url: item.url || "",
        content: item.markdown || "",
      }));
    } else if (providerOptions.provider === "serpdive") {
      if (!serpdive) {
        return {
          results: [],
          error:
            "SERPdive is not configured. Set SERPDIVE_API_KEY or choose a different provider.",
        };
      }
      const { provider: _provider, ...searchOptions } = providerOptions;
      const response = await serpdive.search(query, {
        maxResults,
        ...searchOptions,
      });

      results = response.results.map((r) => ({
        source: "web",
        title: r.title || "",
        url: r.url,
        content: r.content,
      }));
    }

    log.debug(
      { query, maxResults, provider: providerOptions.provider },
      "webSearchStep success"
    );
    return { results };
  } catch (error: unknown) {
    const { message, stack, status, data } = extractErrorInfo(error);

    log.error(
      {
        err: error,
        message,
        stack,
        status,
        data,
        query,
        providerOptions,
      },
      "Error in webSearchStep"
    );
    return {
      results: [],
      error: JSON.stringify(
        {
          message,
          status,
          data,
        },
        null,
        2
      ),
    };
  }
}
