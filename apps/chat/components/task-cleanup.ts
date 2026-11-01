const withTaskCleanup = async <Value>(
  task: () => Promise<Value>,
  cleanup: () => void | Promise<void>
): Promise<Value> => {
  try {
    return await task();
  } finally {
    const completion = cleanup();
    if (completion !== undefined) {
      await completion;
    }
  }
};

export { withTaskCleanup };
