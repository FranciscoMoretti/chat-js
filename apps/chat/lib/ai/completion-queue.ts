export type CompletionQueue = {
  enqueue: (completion: () => Promise<void>) => void;
  waitForIdle: () => Promise<void>;
};

const runCompletion = async (
  previous: Promise<void>,
  completion: () => Promise<void>,
  onError: (error: unknown) => void
) => {
  try {
    await previous;
    return await completion();
  } catch (error) {
    return onError(error);
  }
};

export const createCompletionQueue = (
  onError: (error: unknown) => void
): CompletionQueue => {
  let pending = Promise.resolve();

  return {
    enqueue(completion) {
      pending = runCompletion(pending, completion, onError);
    },
    waitForIdle() {
      return pending;
    },
  };
};
