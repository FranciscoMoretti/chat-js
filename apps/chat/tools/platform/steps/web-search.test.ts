import { afterEach, expect, test, vi } from "vitest";

import { webSearchStep } from "./web-search";

vi.mock("@/lib/env", () => ({ env: { TAVILY_API_KEY: "test-only-key" } }));
afterEach(() => vi.unstubAllGlobals());

test("Tavily search forwards filters and cancellation to the HTTP request", async () => {
  const controller = new AbortController();
  const aborted = Promise.withResolvers<void>();
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => {
            aborted.resolve();
            reject(options.signal?.reason);
          },
          { once: true }
        );
      })
  );
  vi.stubGlobal("fetch", fetchMock);
  const result = webSearchStep({
    query: "example",
    maxResults: 2,
    providerOptions: {
      provider: "tavily",
      searchDepth: "advanced",
      excludeDomains: ["excluded.invalid"],
    },
    abortSignal: controller.signal,
  });
  const rejected = expect(result).rejects.toThrow();
  controller.abort();
  await aborted.promise;
  await rejected;
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.tavily.com/search",
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"search_depth":"advanced"'),
    })
  );
  const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(body).toMatchObject({
    max_results: 2,
    exclude_domains: ["excluded.invalid"],
  });
});
