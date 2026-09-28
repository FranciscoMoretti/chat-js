import { expect, test, vi } from "vitest";

import { executeWithResearchProgress } from "./research-progress";

test("progress is durable and an explicitly reported failure preserves known costs", async () => {
  const results = await Array.fromAsync(
    executeWithResearchProgress(
      { abortSignal: new AbortController().signal },
      ({ usage, dataStream }) => {
        dataStream.write({
          data: {
            queries: ["test"],
            status: "running",
            title: "Search",
            toolCallId: "call",
            type: "web",
          },
          id: "search",
          type: "data-researchUpdate",
        });
        usage.addCostUsd(0.05);
        return usage.fail();
      }
    )
  );
  expect(results[0]).toMatchObject({
    status: "success",
    updates: [{ status: "running" }],
  });
  expect(results.at(-1)).toMatchObject({
    output: null,
    status: "error",
    updates: [{ status: "running" }],
    usage: { costUsd: 0.05 },
  });
});
test("closing the native iterator cancels provider work", async () => {
  const cancelled = vi.fn();
  const iterator = executeWithResearchProgress(
    { abortSignal: new AbortController().signal },
    async ({ dataStream, abortSignal }) => {
      dataStream.write({
        data: {
          timestamp: 0,
          title: "Search",
          toolCallId: "call",
          type: "started",
        },
        type: "data-researchUpdate",
      });
      const pending = Promise.withResolvers<never>();
      abortSignal.addEventListener(
        "abort",
        () => {
          cancelled();
          pending.reject(abortSignal.reason);
        },
        { once: true }
      );
      await pending.promise;
      return { searches: [] };
    }
  );
  await iterator.next();
  await iterator.return(undefined);
  expect(cancelled).toHaveBeenCalledOnce();
});
