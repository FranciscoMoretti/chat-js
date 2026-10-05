class PreviewConfigurationError extends Error {
  public override name = "PreviewConfigurationError";
}

// PostgreSQL URLs use a non-special scheme, so normalize DNS names explicitly.
const normalizedHost = (host: string): string =>
  host.toLowerCase().replace(/\.$/u, "");
const directHost = (host: string): string =>
  normalizedHost(host).replace("-pooler.", ".");
const neonHost = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+neon\.tech$/u;
const EMPTY_STRING_LENGTH = 0;

type UrlAuthority = Readonly<Pick<URL, "username" | "password" | "port">>;
const matchingAuthority = (
  app: UrlAuthority,
  migration: UrlAuthority
): boolean => {
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

type ConnectionUrl = Readonly<
  Pick<
    URL,
    "hostname" | "pathname" | "protocol" | "username" | "password" | "port"
  >
>;
const isValidConnectionPair = (
  app: ConnectionUrl,
  migration: ConnectionUrl,
  parentHost: string
): boolean => {
  const migrationHost = normalizedHost(migration.hostname);
  return (
    ["postgres:", "postgresql:"].includes(app.protocol) &&
    ["postgres:", "postgresql:"].includes(migration.protocol) &&
    neonHost.test(migrationHost) &&
    !migrationHost.includes("-pooler.") &&
    directHost(app.hostname) === migrationHost &&
    app.pathname === migration.pathname &&
    matchingAuthority(app, migration) &&
    migrationHost !== directHost(parentHost)
  );
};

const parseConnectionUrls = (
  pooled: string,
  direct: string
): readonly [URL, URL] => {
  try {
    return [new URL(pooled), new URL(direct)];
  } catch {
    throw new PreviewConfigurationError(
      "Preview database connection URLs are invalid."
    );
  }
};

const validateParentHost = (parentHost: string): void => {
  if (!neonHost.test(normalizedHost(parentHost))) {
    throw new PreviewConfigurationError(
      "Preview database parent must be a Neon hostname without a scheme, port, or path."
    );
  }
};

const validateDatabaseConnections = (
  pooled: string,
  direct: string,
  parentHost: string
): void => {
  validateParentHost(parentHost);

  const [app, migration] = parseConnectionUrls(pooled, direct);
  if (!isValidConnectionPair(app, migration, parentHost)) {
    throw new PreviewConfigurationError(
      "Preview database must use matching pooled/direct connections to an isolated Neon branch, not its parent."
    );
  }
};

type Environment = Readonly<Record<string, string | undefined>>;
const validateProjectConfiguration = (source: Environment): void => {
  if (
    typeof source.CHATJS_PREVIEW_NEON_PROJECT_ID !== "string" ||
    source.CHATJS_PREVIEW_NEON_PROJECT_ID.length === EMPTY_STRING_LENGTH ||
    source.NEON_PROJECT_ID !== source.CHATJS_PREVIEW_NEON_PROJECT_ID
  ) {
    throw new PreviewConfigurationError(
      "Preview database must belong to the configured maintainer Neon project."
    );
  }
};

interface ConnectionConfiguration {
  direct: string;
  parentHost: string;
  pooled: string;
}
const readConnectionConfiguration = (
  source: Environment
): ConnectionConfiguration => {
  const pooled = source.DATABASE_URL;
  const direct = source.DATABASE_URL_UNPOOLED;
  const parentHost = source.CHATJS_PREVIEW_PARENT_HOST;
  if (
    typeof pooled !== "string" ||
    pooled.length === EMPTY_STRING_LENGTH ||
    typeof direct !== "string" ||
    direct.length === EMPTY_STRING_LENGTH ||
    typeof parentHost !== "string" ||
    parentHost.length === EMPTY_STRING_LENGTH
  ) {
    throw new PreviewConfigurationError(
      "Preview database configuration is incomplete."
    );
  }
  return { direct, parentHost, pooled };
};

/**
 * Validate the ChatJS demo preview infrastructure configuration.
 * @param {Environment} source - Environment values supplied to the maintainer preview build.
 * @returns {{ DATABASE_MIGRATION_URL: string; DATABASE_URL: string } | undefined} Isolated pooled/direct database URLs, or undefined outside preview deployments.
 */
const resolveMaintainerPreviewDatabase = (
  source: Environment
): { DATABASE_MIGRATION_URL: string; DATABASE_URL: string } | undefined => {
  if (source.VERCEL !== "1" || source.VERCEL_ENV !== "preview") {
    // oxlint-disable-next-line eslint/no-undefined -- Explicitly return the documented no-preview sentinel; consistent-return requires a value alongside the configured result.
    return undefined;
  }

  validateProjectConfiguration(source);
  const { pooled, direct, parentHost } = readConnectionConfiguration(source);

  validateDatabaseConnections(pooled, direct, parentHost);

  return { DATABASE_MIGRATION_URL: direct, DATABASE_URL: pooled };
};
export { PreviewConfigurationError, resolveMaintainerPreviewDatabase };
