/** Maintainer-only validation for the ChatJS demo preview infrastructure. */
export const resolveMaintainerPreviewDatabase = (
  source: Record<string, string | undefined>
) => {
  if (source.VERCEL !== "1" || source.VERCEL_ENV !== "preview") {
    return;
  }

  if (
    !source.CHATJS_PREVIEW_NEON_PROJECT_ID ||
    source.NEON_PROJECT_ID !== source.CHATJS_PREVIEW_NEON_PROJECT_ID
  ) {
    throw new Error(
      "Preview database must belong to the configured maintainer Neon project."
    );
  }
  const pooled = source.DATABASE_URL;
  const direct = source.DATABASE_URL_UNPOOLED;
  const parentHost = source.CHATJS_PREVIEW_PARENT_HOST;
  if (!(pooled && direct && parentHost)) {
    throw new Error("Preview database configuration is incomplete.");
  }

  let app: URL;
  let migration: URL;
  try {
    app = new URL(pooled);
    migration = new URL(direct);
  } catch {
    throw new Error("Preview database connection URLs are invalid.");
  }
  const appHost = app.hostname.replace("-pooler.", ".");
  if (
    !["postgres:", "postgresql:"].includes(app.protocol) ||
    !["postgres:", "postgresql:"].includes(migration.protocol) ||
    !migration.hostname.endsWith(".neon.tech") ||
    migration.hostname.includes("-pooler.") ||
    appHost !== migration.hostname ||
    app.pathname !== migration.pathname ||
    app.username !== migration.username ||
    migration.hostname === parentHost.replace("-pooler.", ".")
  ) {
    throw new Error(
      "Preview database must use matching pooled/direct connections to an isolated Neon branch, not its parent."
    );
  }

  return { DATABASE_MIGRATION_URL: direct, DATABASE_URL: pooled };
};
