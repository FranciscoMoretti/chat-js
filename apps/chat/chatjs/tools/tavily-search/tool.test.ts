import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { testToolContext } from "@/tests/helpers/eve-tool-context";
import { webSearch } from "./tool";
import { webSearchInput } from "./schemas";
import { z } from "zod";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@tavily/core", (): { tavily: () => { search: typeof search } } => ({
  tavily: (): { search: typeof search } => ({ search }),
}));
beforeEach(() => vi.stubEnv("TAVILY_API_KEY", "test-key"));
afterEach(() => vi.unstubAllEnvs());

vi.mock("@/lib/id", () => ({ generateUUID: (): string => "search-update" }));

const collect = async <SearchValue>(
  value:
    | Readonly<SearchValue>
    | Readonly<Promise<SearchValue>>
    | Readonly<AsyncIterable<SearchValue>>
): Promise<SearchValue[]> => {
  const result = await value;
  if (
    typeof result !== "object" ||
    result === null ||
    !(Symbol.asyncIterator in result)
  ) {
    throw new Error("Expected streaming search results");
  }
  return await Array.fromAsync(result);
};

test("native search streams sources and seals a final cost receipt", async () => {
  search.mockResolvedValue({
    results: [
      { content: "Evidence", title: "Source", url: "https://example.com" },
    ],
  });
  const results = await collect(
    webSearch.execute(
      {
        exclude_domains: ["excluded.com"],
        searchDepth: "advanced",
        search_queries: [{ maxResults: 3, query: "news" }],
        topics: ["news"],
      },
      testToolContext({ callId: "call" })
    )
  );
  const finalResult = results.at(-1);
  if (!finalResult) {
    throw new Error("Expected a final search result");
  }
  expect(search).toHaveBeenCalledWith(
    "news",
    expect.objectContaining({
      days: 7,
      excludeDomains: ["excluded.com"],
      maxResults: 3,
      searchDepth: "advanced",
      topic: "news",
    })
  );
  expect(finalResult).toMatchObject({
    output: { searches: [{ results: [{ title: "Source" }] }] },
    status: "success",
    usage: { costUsd: 0.05 },
  });
  expect(finalResult.updates).toContainEqual(
    expect.objectContaining({
      results: [expect.objectContaining({ source: "web", title: "Source" })],
      status: "completed",
      toolCallId: "call",
      type: "web",
    })
  );
  expect(results.length).toBeGreaterThan(1);
});
test("strict fields remain required while explicit nulls apply defaults", async () => {
  search.mockResolvedValue({ results: [] });
  const json = z.toJSONSchema(webSearchInput);
  expect(json.required).toEqual(
    expect.arrayContaining([
      "search_queries",
      "topics",
      "searchDepth",
      "exclude_domains",
    ])
  );
  expect(
    webSearchInput.safeParse({ search_queries: [{ query: "defaults" }] })
      .success
  ).toBe(false);
  await collect(
    webSearch.execute(
      {
        exclude_domains: null,
        searchDepth: null,
        search_queries: [{ maxResults: null, query: "defaults" }],
        topics: null,
      },
      testToolContext()
    )
  );
  expect(search).toHaveBeenCalledWith(
    "defaults",
    expect.objectContaining({
      excludeDomains: [],
      maxResults: 5,
      searchDepth: "basic",
      topic: "general",
    })
  );
});
