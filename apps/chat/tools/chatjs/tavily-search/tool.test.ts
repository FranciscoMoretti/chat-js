import { expect, test, vi } from "vitest";
import { z } from "zod";

import { testToolContext } from "@/tests/helpers/eve-tool-context";

import { webSearchInput } from "./schemas";
import { webSearch } from "./tool";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@tavily/core")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@tavily/core", () => ({ tavily: () => ({ search }) }));
/* oxlint-enable typescript/explicit-function-return-type */
vi.mock("@/lib/env", () => ({ env: { TAVILY_API_KEY: "test-key" } }));

vi.mock("@/lib/utils", () => ({ generateUUID: (): string => "search-update" }));

/* oxlint-disable id-length, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): collect uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * oxc/no-async-await (#540): collect sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep collect's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): collect accepts value: T | Promise<T> | AsyncIterable<T>; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
const collect = async <T>(value: T | Promise<T> | AsyncIterable<T>) => {
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
/* oxlint-enable id-length, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): test("native search streams sources and seals a final cost receipt") uses -1, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("native search streams sources and seals a final cost receipt") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("native search streams sources and seals a final cost receipt") handles optional results.at(-1)?.updates without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
/* oxlint-enable no-magic-numbers */
/* oxlint-disable unicorn/no-null  --
 * oxc/no-async-await (#540): test("strict fields remain required while explicit nulls apply defaults") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
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
/* oxlint-enable unicorn/no-null */
