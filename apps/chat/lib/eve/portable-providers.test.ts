import { afterEach, expect, it, vi } from "vitest";
import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { withToolAccounting } from "./tool-accounting";
import {
  webSearch as tavilySearch,
  searchUpdates,
} from "../../../../packages/registry/src/tools/tavily-search/tool";
import { webSearch as firecrawlSearch } from "../../../../packages/registry/src/tools/firecrawl-search/tool";
import { retrieveUrl } from "../../../../packages/registry/src/tools/retrieve-url/tool";

const provider = vi.hoisted(() => ({
  search: vi.fn(),
  scrape: vi.fn(),
  extract: vi.fn(),
}));
vi.mock("@tavily/core", () => ({
  tavily: () => ({ search: provider.search }),
}));
vi.mock("@mendable/firecrawl-js", () => ({
  default: class Firecrawl {
    search = provider.search;
    scrapeUrl = provider.scrape;
    extract = provider.extract;
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

const collect = async <T>(
  result: T | Promise<T> | AsyncIterable<T>
): Promise<T[]> => {
  const output = await result;
  if (
    typeof output === "object" &&
    output !== null &&
    Symbol.asyncIterator in output
  ) {
    return await Array.fromAsync(output);
  }
  return [output];
};

it("uses Tavily options and retains native projections while ChatJS settles its declared charge", async () => {
  vi.stubEnv("TAVILY_API_KEY", "test-only");
  const source = {
    title: "Source",
    content: "Evidence",
    url: "https://example.test",
  };
  provider.search.mockResolvedValue({ results: [source] });
  const tool = withToolAccounting(
    tavilySearch,
    { costUsd: 0.05 },
    searchUpdates
  );
  const outputs = await collect(
    tool.execute(
      {
        search_queries: [{ query: "news", maxResults: null }],
        searchDepth: "advanced",
        topics: ["news"],
        exclude_domains: ["excluded.test"],
      },
      testToolContext()
    )
  );
  expect(provider.search).toHaveBeenCalledExactlyOnceWith("news", {
    days: 7,
    excludeDomains: ["excluded.test"],
    includeAnswer: true,
    maxResults: 5,
    searchDepth: "advanced",
    topic: "news",
  });
  const receipt = outputs.at(-1);
  expect(receipt?.usage.costUsd).toBe(0.05);
  expect(receipt?.updates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: "web", status: "completed" }),
    ])
  );
  if (!receipt) {
    throw new Error("Missing receipt");
  }
  expect(await tool.toModelOutput?.(receipt)).toEqual({
    type: "json",
    value: {
      searches: [
        { query: { query: "news", maxResults: 5 }, results: [source] },
      ],
    },
  });
});

it("maps Firecrawl results without leaking metadata and reports missing configuration before search", async () => {
  vi.stubEnv("FIRECRAWL_API_KEY", "");
  expect(() => {
    void firecrawlSearch.execute({ search_queries: [] }, testToolContext());
  }).toThrow("FIRECRAWL_API_KEY");
  expect(provider.search).not.toHaveBeenCalled();
  vi.stubEnv("FIRECRAWL_API_KEY", "test-only");
  provider.search.mockResolvedValue({
    data: [
      {
        markdown: "Evidence",
        title: "Source",
        url: "https://example.test",
        secret: "private",
      },
    ],
  });
  const outputs = await collect(
    firecrawlSearch.execute(
      { search_queries: [{ query: "query", maxResults: 2 }] },
      testToolContext()
    )
  );
  expect(outputs.at(-1)?.searches[0].results).toEqual([
    { content: "Evidence", title: "Source", url: "https://example.test" },
  ]);
  expect(provider.search).toHaveBeenCalledExactlyOnceWith("query", {
    limit: 2,
    scrapeOptions: { formats: ["markdown"] },
    timeout: 15_000,
  });
});

it("retrieval redacts URL credentials, validates extraction and leaves provider cost unknown", async () => {
  vi.stubEnv("FIRECRAWL_API_KEY", "test-only");
  provider.scrape.mockResolvedValue({
    success: true,
    metadata: { language: "en" },
  });
  provider.extract.mockResolvedValue({
    success: true,
    data: {
      title: "Title",
      content: "Page",
      description: "Summary",
      secret: "private",
    },
  });
  const tool = withToolAccounting(retrieveUrl, "unknown");
  const outputs = await collect(
    tool.execute(
      { url: "https://user:pass@example.test/page?token=private#secret" },
      testToolContext()
    )
  );
  expect(outputs.at(-1)).toMatchObject({
    output: {
      results: [
        {
          title: "Title",
          content: "Page",
          description: "Summary",
          language: "en",
          url: "https://example.test/page",
        },
      ],
    },
    usage: {},
  });
  expect(outputs.at(-1)?.usage.costUsd).toBeUndefined();
  expect(JSON.stringify(outputs)).not.toMatch(/private|pass|secret/u);
});

it("retrieval propagates cancellation before fallback work and suppresses provider diagnostics", async () => {
  vi.stubEnv("FIRECRAWL_API_KEY", "test-only");
  const controller = new AbortController();
  provider.scrape.mockImplementationOnce(async () => {
    controller.abort();
    return await Promise.resolve({ success: true, metadata: {} });
  });
  await expect(
    retrieveUrl.execute(
      { url: "https://example.test" },
      testToolContext({ abortSignal: controller.signal })
    )
  ).rejects.toThrow();
  expect(provider.extract).not.toHaveBeenCalled();
  provider.scrape.mockRejectedValueOnce(new Error("credential-secret"));
  expect(
    await retrieveUrl.execute(
      { url: "https://example.test" },
      testToolContext()
    )
  ).toEqual({ error: "Failed to retrieve content" });
});

it("does not expose provider error payloads on unsuccessful retrieval responses", async () => {
  vi.stubEnv("FIRECRAWL_API_KEY", "test-only");
  provider.scrape.mockResolvedValue({
    success: false,
    error: "private provider diagnostic",
  });
  const output = await collect(
    retrieveUrl.execute({ url: "https://example.test" }, testToolContext())
  );
  expect(output).toEqual([
    { results: [{ error: "Failed to retrieve content" }] },
  ]);
  expect(provider.extract).not.toHaveBeenCalled();
});
