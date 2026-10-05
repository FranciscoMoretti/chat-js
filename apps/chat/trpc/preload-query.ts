// Preloads populate the hydration cache without exposing failures to callers.
const preloadQuery = async (
  pending: Readonly<Promise<unknown>>
): Promise<void> => {
  try {
    await pending;
  } catch {
    // Query state retains the error; preloading deliberately resolves without it.
  }
};

export { preloadQuery };
