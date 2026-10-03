import { expect, test, vi } from "vitest";

import { executeWithResearchProgress } from "./research-progress";

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * no-magic-numbers (#517): test("progress is durable and an explicitly reported failure preserves known costs") uses 0.05, 0, -1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("progress is durable and an explicitly reported failure preserves known costs") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("progress is durable and an explicitly reported failure preserves known costs") accepts { usage, dataStream }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): test("progress is durable and an explicitly reported failure preserves known costs") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * no-undefined (#519): test("closing the native iterator cancels provider work") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("closing the native iterator cancels provider work") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("closing the native iterator cancels provider work") accepts { dataStream, abortSignal }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types */
