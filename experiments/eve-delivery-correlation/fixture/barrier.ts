const number0 = 0;
const fixtureHome = (): string => {
  // oxlint-disable-next-line node/no-process-env -- Read only the isolated worker configuration; provider and application credentials are never forwarded.
  const root = process.env.HOME;
  if (typeof root !== "string" || root.length === number0) {
    throw new Error("Missing disposable fixture HOME");
  }
  return root;
};
export { fixtureHome };
