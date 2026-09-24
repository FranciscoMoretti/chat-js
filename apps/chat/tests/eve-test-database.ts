/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/** Remote acceptance tests require both an explicit opt-in and an isolated target. */
export function assertEveTestDatabase(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (
    ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    return;
  }
  const isolated = process.env.EVE_TEST_DATABASE_URL;
  if (
    process.env.EVE_ALLOW_REMOTE_DATABASE_TESTS !== "true" ||
    !isolated ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    new URL(isolated).href !== url.href
  ) {
    throw new Error(
      "Eve tests require local PostgreSQL. Remote tests require EVE_ALLOW_REMOTE_DATABASE_TESTS=true and a matching isolated EVE_TEST_DATABASE_URL."
    );
  }
}
