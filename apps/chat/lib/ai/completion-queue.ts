export type CompletionQueue = {
  enqueue: (completion: () => Promise<void>) => void;
  waitForIdle: () => Promise<void>;
};

export function createCompletionQueue(
  onError: (error: unknown) => void
): CompletionQueue {
  let pending = Promise.resolve();

  return {
    enqueue(completion) {
      pending = pending.then(completion).catch(onError);
    },
    waitForIdle() {
      return pending;
    },
  };
}
