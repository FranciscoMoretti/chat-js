/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve preloadQuery's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
export { preloadQuery };
