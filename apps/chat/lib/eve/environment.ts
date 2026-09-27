import { resolveWorkflowWorld } from "./world-config";

type Environment = Record<string, string | undefined>;

export const resolveWorkflowDatabaseUrl = (source: Environment) =>
  resolveWorkflowWorld(source) === "vercel"
    ? undefined
    : source.WORKFLOW_POSTGRES_URL ||
      source.DATABASE_MIGRATION_URL ||
      source.DATABASE_URL;

/** Only the server evaluates these defaults; no secret is a NEXT_PUBLIC value. */
export const resolveEveEnvironment = (source: Environment) => ({
  EVE_GATEWAY_SECRET: source.EVE_GATEWAY_SECRET,
  EVE_INTERNAL_ORIGIN:
    source.EVE_INTERNAL_ORIGIN ||
    (source.VERCEL_URL
      ? `https://${source.VERCEL_URL}`
      : source.APP_URL ||
        source.PLAYWRIGHT_TEST_BASE_URL ||
        `http://localhost:${source.PORT || "3000"}`),
  WORKFLOW_POSTGRES_URL: resolveWorkflowDatabaseUrl(source),
});

/** EVE's PostgreSQL provider reads process.env instead of ChatJS's env object.
 * Run during agent module initialization, before EVE constructs its World. */
export const configureWorkflowEnvironment = (source: Environment) => {
  const url = resolveWorkflowDatabaseUrl(source);
  if (url) {
    source.WORKFLOW_POSTGRES_URL = url;
  }
};

/** Known transaction-pooler endpoints cannot support Workflow's LISTEN sessions.
 * Unknown hosts still require a direct or session connection supplied by the operator. */
export const isWorkflowTransactionPooler = (value: string) => {
  const url = new URL(value);
  return (
    url.searchParams.get("pgbouncer") === "true" ||
    url.searchParams.get("pool_mode") === "transaction" ||
    (url.hostname.endsWith(".neon.tech") &&
      url.hostname.includes("-pooler.")) ||
    (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543")
  );
};
