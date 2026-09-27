/** Vercel's Neon integration injects these values for an isolated preview branch. */
export const resolvePreviewDatabaseEnvironment = (
  source: Record<string, string | undefined>
) => {
  if (
    source.VERCEL !== "1" ||
    source.VERCEL_ENV !== "preview" ||
    !source.CHATJS_PREVIEW_NEON_PROJECT_ID
  ) {
    return;
  }

  const pooled = source.CHATJS_PREVIEW_DATABASE_URL;
  const direct = source.CHATJS_PREVIEW_DATABASE_URL_UNPOOLED;
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
