import { expect, test, vi } from "vitest";
import { z } from "zod";

import { testToolContext } from "@/tests/helpers/eve-tool-context";

import { webSearchInput } from "./schemas";
import { webSearch } from "./tool";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@tavily/core", () => ({ tavily: () => ({ search }) }));
vi.mock("@/lib/env", () => ({ env: { TAVILY_API_KEY: "test-key" } }));
vi.mock("@/lib/utils", () => ({ generateUUID: () => "search-update" }));
const collect = async <T>(value: T | Promise<T> | AsyncIterable<T>) => {
  const result = await value;
  if (
    typeof result !== "object" ||
    result === null ||
    !(Symbol.asyncIterator in result)
  ) {
    throw new Error("Expected streaming search results");
  }
  return Array.fromAsync(result);
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
  expect(results.at(-1)).toMatchObject({
    output: { searches: [{ results: [{ title: "Source" }] }] },
    status: "success",
    usage: { costUsd: 0.05 },
  });
  expect(results.at(-1)?.updates).toContainEqual(
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
