import FirecrawlApp, { type SearchParams } from "@mendable/firecrawl-js";
import type { TavilySearchOptions } from "@tavily/core";
import { z } from "zod";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";

export type SearchProviderOptions =
  | ({
      provider: "tavily";
    } & Omit<TavilySearchOptions, "limit">)
  | ({
      provider: "firecrawl";
    } & SearchParams);

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
const firecrawl = env.FIRECRAWL_API_KEY
  ? new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY })
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
  abortSignal,
}: {
  query: string;
  maxResults: number;
  providerOptions: SearchProviderOptions;
  abortSignal?: AbortSignal;
}): Promise<WebSearchResponse> {
  try {
    abortSignal?.throwIfAborted();
    let results: WebSearchResult[] = [];

    if (providerOptions.provider === "tavily") {
      if (!env.TAVILY_API_KEY) {
        return {
          results: [],
          error:
            "Tavily is not configured. Set TAVILY_API_KEY or choose a different provider.",
        };
      }
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.TAVILY_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.any([
          ...(abortSignal ? [abortSignal] : []),
          AbortSignal.timeout((providerOptions.timeout ?? 60) * 1000),
        ]),
        body: JSON.stringify({
          query,
          search_depth: providerOptions.searchDepth ?? "basic",
          max_results: providerOptions.maxResults ?? maxResults,
          topic: providerOptions.topic ?? "general",
          days: providerOptions.days,
          include_answer: providerOptions.includeAnswer ?? true,
          include_images: providerOptions.includeImages,
          include_image_descriptions: providerOptions.includeImageDescriptions,
          include_raw_content: providerOptions.includeRawContent,
          include_domains: providerOptions.includeDomains,
          exclude_domains: providerOptions.excludeDomains,
          time_range: providerOptions.timeRange,
          chunks_per_source: providerOptions.chunksPerSource,
        }),
      });
      if (!response.ok) {
        throw new Error(`Search provider returned HTTP ${response.status}.`);
      }
      const result = z
        .object({
          results: z.array(
            z.object({
              url: z.string(),
              title: z.string(),
              content: z.string(),
            })
          ),
        })
        .parse(await response.json());

      results = result.results.map((r) => ({
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
    }

    log.debug(
      { query, maxResults, provider: providerOptions.provider },
      "webSearchStep success"
    );
    return { results };
  } catch (error: unknown) {
    abortSignal?.throwIfAborted();
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
