const number0 = 0;
const fixtureHome = (): string => {
  const root = process.env.HOME;
  if (typeof root !== "string" || root.length === number0) {
    throw new Error("Missing disposable fixture HOME");
  }
  return root;
};
export { fixtureHome };
