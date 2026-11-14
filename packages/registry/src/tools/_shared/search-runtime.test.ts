import { expect, test } from "bun:test";
import { searchSnapshots } from "./search-runtime";

const context = {
  callId: "search",
  title: "Searching",
  completeTitle: "Search complete",
  abortSignal: new AbortController().signal,
};

test("native search retains sources and progress without leaking provider fields or failures", async () => {
  const queries = [
    { query: "one", maxResults: 2, secret: "private" },
    { query: "two", maxResults: 2 },
  ];
  const outputs = await Array.fromAsync(
    searchSnapshots({
      ...context,
      queries,
      search: async (query, index) => {
        expect(query).not.toHaveProperty("secret");
        if (index === 1) {
          return await Promise.reject(
            new Error("Provider diagnostic with secret credential")
          );
        }
        queries[0].query = "caller mutation";
        return await Promise.resolve([
          {
            title: "First",
            url: "https://example.test/a",
            content: "Source",
            secret: "upstream secret",
          },
          {
            title: "Duplicate domain",
            url: "https://example.test/b",
            content: "Hidden",
          },
        ]);
      },
    })
  );
  expect(outputs[0].updates.at(-1)).toMatchObject({
    type: "web",
    status: "running",
  });
  expect(outputs.at(-1)).toMatchObject({
    searches: [
      {
        query: { query: "one", maxResults: 2 },
        results: [
          { title: "First", url: "https://example.test/a", content: "Source" },
        ],
      },
    ],
    error: "Some searches failed. Please try again.",
  });
  expect(JSON.stringify(outputs)).not.toContain("secret");
  expect(
    outputs.at(-1)?.updates.filter((update) => update.type === "web")
  ).toHaveLength(1);
});

test("cancelled native search does not yield a successful final snapshot", async () => {
  const controller = new AbortController();
  const snapshots = searchSnapshots({
    ...context,
    abortSignal: controller.signal,
    queries: [{ query: "query", maxResults: 1 }],
    search: async () => {
      controller.abort();
      return await Promise.resolve([]);
    },
  });
  const first = await snapshots.next();
  expect(first.done).toBe(false);
  const next = snapshots.next();
  expect(next).rejects.toThrow();
  await next.catch(() => null);
});
