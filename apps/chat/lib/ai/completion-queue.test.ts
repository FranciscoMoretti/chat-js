import { describe, expect, it, vi } from "vitest";

import { createCompletionQueue } from "./completion-queue";

const deferred = () => {
  const { promise, resolve: resolvePromise } = Promise.withResolvers<null>();
  return { promise, resolve: () => resolvePromise(null) };
};

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

  it("reports synchronous throws without interrupting enqueue", async () => {
    const error = new Error("completion threw");
    const onError = vi.fn();
    const queue = createCompletionQueue(onError);
    const laterCompletion = vi.fn(() => Promise.resolve());

    queue.enqueue(() => {
      throw error;
    });
    queue.enqueue(laterCompletion);

    await queue.waitForIdle();
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(laterCompletion).toHaveBeenCalledOnce();
  });

  it("keeps an idle snapshot scoped to the completions already queued", async () => {
    const first = deferred();
    const second = deferred();
    const events: string[] = [];
    const queue = createCompletionQueue(vi.fn());

    queue.enqueue(async () => {
      await first.promise;
      events.push("first");
    });
    const firstIdle = queue.waitForIdle();
    queue.enqueue(async () => {
      await second.promise;
      events.push("second");
    });

    first.resolve();
    await firstIdle;
    expect(events).toEqual(["first"]);

    second.resolve();
    await queue.waitForIdle();
    expect(events).toEqual(["first", "second"]);
  });

  it("propagates an error-handler failure and skips the next completion", async () => {
    const completionError = new Error("completion failed");
    const handlerError = new Error("error handler failed");
    const onError = vi.fn().mockImplementationOnce(() => {
      throw handlerError;
    });
    const queue = createCompletionQueue(onError);
    const skippedCompletion = vi.fn(() => Promise.resolve());

    queue.enqueue(() => Promise.reject(completionError));
    const failedIdle = queue.waitForIdle();
    queue.enqueue(skippedCompletion);

    await expect(failedIdle).rejects.toBe(handlerError);
    await queue.waitForIdle();
    expect(onError.mock.calls).toEqual([[completionError], [handlerError]]);
    expect(skippedCompletion).not.toHaveBeenCalled();

    const laterCompletion = vi.fn(() => Promise.resolve());
    queue.enqueue(laterCompletion);
    await queue.waitForIdle();
    expect(laterCompletion).toHaveBeenCalledOnce();
  });
});
