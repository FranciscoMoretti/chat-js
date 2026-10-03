export class PreviewConfigurationError extends Error {
  public override name = "PreviewConfigurationError";
}

// PostgreSQL URLs use a non-special scheme, so normalize DNS names explicitly.
const normalizedHost = (host: string) => host.toLowerCase().replace(/\.$/u, "");
const directHost = (host: string) =>
  normalizedHost(host).replace("-pooler.", ".");
const neonHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+neon\.tech$/u;

const matchingAuthority = (app: URL, migration: URL) => {
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

/** Maintainer-only validation for the ChatJS demo preview infrastructure. */
export const resolveMaintainerPreviewDatabase = (
  source: Record<string, string | undefined>
) => {
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
