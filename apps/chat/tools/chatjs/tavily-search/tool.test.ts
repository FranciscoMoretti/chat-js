import { expect, test, vi } from "vitest";
import { testToolContext } from "@/tests/helpers/eve-tool-context";
import { webSearch } from "./tool";
import { webSearchInput } from "./schemas";
import { z } from "zod";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@tavily/core", (): { tavily: () => { search: typeof search } } => ({
  tavily: (): { search: typeof search } => ({ search }),
}));
vi.mock("@/lib/env", () => ({ env: { TAVILY_API_KEY: "test-key" } }));

vi.mock("@/lib/utils", () => ({ generateUUID: (): string => "search-update" }));

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve collect's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): this query fixture asserts maxResults 3 and days 7, receipt cost 0.05, the final stream item via at(-1), and more than one yielded item.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): test("strict fields remain required while explicit nulls apply defaults") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
