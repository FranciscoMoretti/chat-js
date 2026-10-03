class PreviewConfigurationError extends Error {
  public override name = "PreviewConfigurationError";
}

// PostgreSQL URLs use a non-special scheme, so normalize DNS names explicitly.
const normalizedHost = (host: string): string =>
  host.toLowerCase().replace(/\.$/u, "");
const directHost = (host: string): string =>
  normalizedHost(host).replace("-pooler.", ".");
const neonHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+neon\.tech$/u;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- matchingAuthority: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const matchingAuthority = (app: URL, migration: URL): boolean => {
  try {
    return (
      decodeURIComponent(app.username) ===
        decodeURIComponent(migration.username) &&
      decodeURIComponent(app.password) ===
        decodeURIComponent(migration.password) &&
      (app.port || "5432") === (migration.port || "5432")
    );
  } catch {
    throw new PreviewConfigurationError(
      "Preview database credentials have invalid URL encoding."
    );
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-statements -- resolveMaintainerPreviewDatabase: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/max-lines-per-function -- resolveMaintainerPreviewDatabase: The operation keeps its validation, ordered side effects and cleanup in one scope. */
/* oxlint-disable eslint/no-undefined -- resolveMaintainerPreviewDatabase: The API distinguishes omitted/undefined values from null or a concrete result; preserve that sentinel. */
/* oxlint-disable eslint/init-declarations -- resolveMaintainerPreviewDatabase: Assignment occurs only after branch-specific validation; eager initialization would hide definite-assignment guarantees. */
/* oxlint-disable typescript/strict-boolean-expressions -- resolveMaintainerPreviewDatabase: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
/**
 * Validate the ChatJS demo preview infrastructure configuration.
 * @param source - Environment values supplied to the maintainer preview build.
 * @returns Isolated pooled/direct database URLs, or undefined outside preview deployments.
 */
const resolveMaintainerPreviewDatabase = (
  source: Readonly<Record<string, string | undefined>>
): { DATABASE_MIGRATION_URL: string; DATABASE_URL: string } | undefined => {
  if (source.VERCEL !== "1" || source.VERCEL_ENV !== "preview") {
    // oxlint-disable-next-line unicorn/no-useless-undefined -- Explicit absence matches this callback's optional result and consistent-return.
    return undefined;
  }

  if (
    !source.CHATJS_PREVIEW_NEON_PROJECT_ID ||
    source.NEON_PROJECT_ID !== source.CHATJS_PREVIEW_NEON_PROJECT_ID
  ) {
    throw new PreviewConfigurationError(
      "Preview database must belong to the configured maintainer Neon project."
    );
  }
  const pooled = source.DATABASE_URL;
  const direct = source.DATABASE_URL_UNPOOLED;
  const parentHost = source.CHATJS_PREVIEW_PARENT_HOST;
  if (!(pooled && direct && parentHost)) {
    throw new PreviewConfigurationError(
      "Preview database configuration is incomplete."
    );
  }

  const parent = normalizedHost(parentHost);
  if (!neonHost.test(parent)) {
    throw new PreviewConfigurationError(
      "Preview database parent must be a Neon hostname without a scheme, port, or path."
    );
  }

  let app: URL;
  let migration: URL;
  try {
    app = new URL(pooled);
    migration = new URL(direct);
  } catch {
    throw new PreviewConfigurationError(
      "Preview database connection URLs are invalid."
    );
  }
  const migrationHost = normalizedHost(migration.hostname);
  const appHost = directHost(app.hostname);
  if (
    !["postgres:", "postgresql:"].includes(app.protocol) ||
    !["postgres:", "postgresql:"].includes(migration.protocol) ||
    !neonHost.test(migrationHost) ||
    migrationHost.includes("-pooler.") ||
    appHost !== migrationHost ||
    app.pathname !== migration.pathname ||
    !matchingAuthority(app, migration) ||
    migrationHost === directHost(parent)
  ) {
    throw new PreviewConfigurationError(
      "Preview database must use matching pooled/direct connections to an isolated Neon branch, not its parent."
    );
  }

  return { DATABASE_MIGRATION_URL: direct, DATABASE_URL: pooled };
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
export { PreviewConfigurationError, resolveMaintainerPreviewDatabase };
