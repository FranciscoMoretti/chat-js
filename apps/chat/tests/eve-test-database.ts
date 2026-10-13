/**
 * Allows local PostgreSQL test targets and validates explicit opt-in for remote targets.
 * Remote use requires the configured isolated URL to match the target URL.
 * @param {string} databaseUrl Database URL the test suite will use.
 * @returns {void} Completes when the target passes the safety checks.
 * @throws {Error} When a remote target lacks opt-in or does not match the isolated URL.
 */
export const assertEveTestDatabase = (databaseUrl: string): void => {
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
    isolated === undefined ||
    isolated === null ||
    isolated === "" ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    new URL(isolated).href !== url.href
  ) {
    throw new Error(
      "Eve tests require local PostgreSQL. Remote tests require EVE_ALLOW_REMOTE_DATABASE_TESTS=true and a matching isolated EVE_TEST_DATABASE_URL."
    );
  }
};
