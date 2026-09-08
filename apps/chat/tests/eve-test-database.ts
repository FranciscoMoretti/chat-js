/** Remote acceptance tests must target the explicitly provisioned Eve test database. */
export function assertEveTestDatabase(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (["localhost", "127.0.0.1"].includes(url.hostname)) {
    return;
  }
  const isolated = process.env.EVE_TEST_DATABASE_URL;
  if (!isolated || new URL(isolated).href !== url.href) {
    throw new Error(
      "Eve tests require a local database or the dedicated EVE_TEST_DATABASE_URL."
    );
  }
}
