import { beforeEach, expect, test, vi } from "vitest";

import { webSearchStep } from "../../tools/platform/steps/web-search";
import type { createEvePlatformResult } from "./platform-result";
import { executeEvePlatformTool } from "./platform-tools";

vi.mock("../env", () => ({ env: {} }));
const settings = vi.hoisted(() => ({ enabled: true }));
vi.mock("../config", () => ({
  config: {
    ai: {
      tools: {
        webSearch: settings,
        codeExecution: { enabled: false },
        video: { enabled: false },
        image: { enabled: false },
      },
    },
  },
}));
vi.mock("../../tools/platform/steps/web-search", () => ({
  webSearchStep: vi.fn(),
}));

const input = {
  search_queries: [{ query: "example", maxResults: 2 }],
  searchDepth: "advanced",
  topics: null,
  exclude_domains: null,
};
const context = {
  callId: "search-test",
  abortSignal: new AbortController().signal,
};

beforeEach(() => {
  settings.enabled = true;
  vi.mocked(webSearchStep).mockReset();
});

test("streams native progress before the search resolves, then persists one merged result and charge", async () => {
  const deferred =
    Promise.withResolvers<Awaited<ReturnType<typeof webSearchStep>>>();
  vi.mocked(webSearchStep).mockReturnValue(deferred.promise);
  const iterator = executeEvePlatformTool("webSearch", input, context, []);
  const first = await iterator.next();
  expect(first.value?.updates).toContainEqual(
    expect.objectContaining({ type: "started" })
  );
  const running = await iterator.next();
  expect(running.value?.updates).toContainEqual(
    expect.objectContaining({ type: "web", status: "running" })
  );
  expect(webSearchStep).toHaveBeenCalledWith(
    expect.objectContaining({
      providerOptions: expect.objectContaining({ searchDepth: "advanced" }),
    })
  );
  deferred.resolve({
    results: [
      {
        url: "https://example.com",
        title: "Example",
        content: "Found",
        source: "web",
      },
    ],
  });
  const remaining: ReturnType<typeof createEvePlatformResult>[] = [];
  for await (const result of iterator) {
    remaining.push(result);
  }
  const last = remaining.at(-1);
  expect(last?.usage.costUsd).toBe(0.05);
  expect(last?.updates?.filter((update) => update.type === "web")).toHaveLength(
    1
  );
  expect(last?.updates).toContainEqual(
    expect.objectContaining({ type: "web", status: "completed" })
  );
  expect(last?.output).toMatchObject({
    searches: [{ results: [{ title: "Example" }] }],
  });
});

test("provider errors remain visible in the final result", async () => {
  vi.mocked(webSearchStep).mockResolvedValue({
    results: [],
    error: "Unavailable",
  });
  const results: ReturnType<typeof createEvePlatformResult>[] = [];
  for await (const result of executeEvePlatformTool(
    "webSearch",
    input,
    context,
    []
  )) {
    results.push(result);
  }
  expect(results.at(-1)?.output).toMatchObject({
    error: "Some searches failed. Try again or use another source.",
  });
});

test("disabled search cannot execute even if a prior step advertised it", async () => {
  settings.enabled = false;
  await expect(
    executeEvePlatformTool("webSearch", input, context, []).next()
  ).rejects.toThrow("unavailable");
  expect(webSearchStep).not.toHaveBeenCalled();
});

test("closing the native iterator aborts an in-flight search request", async () => {
  const aborted = Promise.withResolvers<void>();
  vi.mocked(webSearchStep).mockImplementation(
    ({ abortSignal }) =>
      new Promise((_resolve, reject) => {
        abortSignal?.addEventListener(
          "abort",
          () => {
            aborted.resolve();
            reject(abortSignal.reason);
          },
          { once: true }
        );
      })
  );
  const iterator = executeEvePlatformTool("webSearch", input, context, []);
  await iterator.next();
  await iterator.return();
  await aborted.promise;
  expect(vi.mocked(webSearchStep).mock.calls[0][0].abortSignal?.aborted).toBe(
    true
  );
});

vi.mock("./generated-files", () => ({
  eveGeneratedFileUploader: () => vi.fn(),
}));

vi.mock("./code-sandbox-ownership", () => ({
  eveCodeSandboxOwnership: () => {
    throw new Error("Unexpected code sandbox in this tool test");
  },
}));
