/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (assertEveTestDatabase); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable jsdoc/require-param, node/no-process-env, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): assertEveTestDatabase's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/strict-boolean-expressions (#610): assertEveTestDatabase intentionally keeps the existing falsy-value behavior of isolated; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/** Remote acceptance tests require both an explicit opt-in and an isolated target. */
export function assertEveTestDatabase(databaseUrl: string): void {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable jsdoc/require-param, node/no-process-env, typescript/strict-boolean-expressions */
