import { describe, expect, it, vi } from "vitest";
import { createCompletionQueue } from "./completion-queue";

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("createCompletionQueue", () => {
  it("runs completions in arrival order and waits for all of them", async () => {
    const first = deferred();
    const events: string[] = [];
    const queue = createCompletionQueue(vi.fn());

    queue.enqueue(async () => {
      events.push("first:start");
      await first.promise;
      events.push("first:end");
    });
    queue.enqueue(() => {
      events.push("second");
      return Promise.resolve();
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    first.resolve();
    await queue.waitForIdle();
    expect(events).toEqual(["first:start", "first:end", "second"]);
  });

  it("reports a failure and continues with later completions", async () => {
    const error = new Error("reconciliation failed");
    const onError = vi.fn();
    const laterCompletion = vi.fn();
    const queue = createCompletionQueue(onError);

    queue.enqueue(() => Promise.reject(error));
    queue.enqueue(() => {
      laterCompletion();
      return Promise.resolve();
    });
    await queue.waitForIdle();

    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(laterCompletion).toHaveBeenCalledOnce();
  });
});
