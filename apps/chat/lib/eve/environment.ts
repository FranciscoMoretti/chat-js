import { resolveWorkflowWorld } from "./world-config";

type Environment = Record<string, string | undefined>;
type ReadonlyEnvironment = Readonly<Environment>;

/* oxlint-disable no-undefined -- moving it below executable initialization can obscure ordering and API ownership.
no-undefined (#519): resolveWorkflowDatabaseUrl uses undefined for absent or optional values; substituting null would alter its type and serialization contract. */
const resolveWorkflowDatabaseUrl = (
  source: ReadonlyEnvironment
): string | undefined => {
  if (resolveWorkflowWorld(source) === "vercel") {
    return undefined;
  }
  const configuredUrl = source.WORKFLOW_POSTGRES_URL;
  return configuredUrl === undefined || configuredUrl === ""
    ? source.DATABASE_URL
    : configuredUrl;
};
/* oxlint-enable no-undefined */

/**
 * Strip app/test URL paths only after checking the scheme and credentials.
 * Preserve invalid input so runtime and CLI schema validation can reject it.
 * @param value Optional configured app or test URL whose usable origin supplies the internal default.
 * @returns The HTTP(S) origin for a valid credential-free URL, or the original absent/invalid value for validation.
 */
const applicationOrigin = (value: string | undefined): string | undefined => {
  if (typeof value !== "string" || value === "" || !URL.canParse(value)) {
    return value;
  }
  const url = new URL(value);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    return value;
  }
  return url.origin;
};

/* oxlint-disable typescript/strict-boolean-expressions -- typescript/strict-boolean-expressions (#610): resolveEveEnvironment intentionally keeps the existing falsy-value behavior of source.EVE_INTERNAL_ORIGIN; source.VERCEL_URL; applicationOrigin(source.APP_URL || source.PLAYWRIGHT_TEST_BASE_URL); source.APP_URL; source.PORT; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Only the server evaluates these defaults; no secret is a NEXT_PUBLIC value.
 * @param source Server environment values used for explicit, deployed, app/test, and local defaults.
 * @returns Gateway secret and internal/workflow endpoints with the original empty-value fallback precedence.
 */
const resolveEveEnvironment = (
  source: ReadonlyEnvironment
): {
  EVE_GATEWAY_SECRET: string | undefined;
  EVE_INTERNAL_ORIGIN: string;
  WORKFLOW_POSTGRES_URL: string | undefined;
} => ({
  EVE_GATEWAY_SECRET: source.EVE_GATEWAY_SECRET,
  EVE_INTERNAL_ORIGIN:
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
    source.EVE_INTERNAL_ORIGIN ||
    (source.VERCEL_URL
      ? `https://${source.VERCEL_URL}`
      : // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
        applicationOrigin(source.APP_URL || source.PLAYWRIGHT_TEST_BASE_URL) ||
        // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
        `http://localhost:${source.PORT || "3000"}`),
  WORKFLOW_POSTGRES_URL: resolveWorkflowDatabaseUrl(source),
});
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): configureWorkflowEnvironment accepts source: Environment; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * EVE's PostgreSQL provider reads process.env instead of ChatJS's env object.
 * Run during agent module initialization, before EVE constructs its World.
 * @param source Mutable server environment whose workflow URL is set to the selected nonempty PostgreSQL default.
 */
const configureWorkflowEnvironment = (source: Environment): void => {
  const url = resolveWorkflowDatabaseUrl(source);
  if (typeof url === "string" && url !== "") {
    source.WORKFLOW_POSTGRES_URL = url;
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/**
 * Known transaction-pooler endpoints cannot support Workflow's LISTEN sessions.
 * Unknown hosts still require a direct or session connection supplied by the operator.
 * @param value Parseable PostgreSQL URL to inspect for known transaction-pooling markers.
 * @returns Whether URL flags or recognized provider host/port patterns identify an incompatible transaction pooler.
 */
const isWorkflowTransactionPooler = (value: string): boolean => {
  const url = new URL(value);
  return (
    url.searchParams.get("pgbouncer") === "true" ||
    url.searchParams.get("pool_mode") === "transaction" ||
    (url.hostname.endsWith(".neon.tech") &&
      url.hostname.includes("-pooler.")) ||
    ((url.hostname.endsWith(".pooler.supabase.com") ||
      (url.hostname.startsWith("db.") &&
        url.hostname.endsWith(".supabase.co"))) &&
      url.port === "6543")
  );
};

export {
  configureWorkflowEnvironment,
  isWorkflowTransactionPooler,
  resolveEveEnvironment,
  resolveWorkflowDatabaseUrl,
};
