import { resolveWorkflowWorld } from "./world-config";

type Environment = Record<string, string | undefined>;
type ReadonlyEnvironment = Readonly<Environment>;

const resolveWorkflowDatabaseUrl = (
  source: ReadonlyEnvironment
): string | undefined => {
  if (resolveWorkflowWorld(source) === "vercel") {
    // oxlint-disable-next-line no-undefined -- Managed Workflow has no PostgreSQL URL; preserve the exported absent-value result.
    return undefined;
  }
  const configuredUrl = source.WORKFLOW_POSTGRES_URL;

  if (typeof configuredUrl !== "string" || configuredUrl === "") {
    return source.DATABASE_URL;
  }
  return configuredUrl;
};

/**
 * Strip app/test URL paths only after checking the scheme and credentials.
 * Preserve invalid input so runtime and CLI schema validation can reject it.
 * @param {string | undefined} value Optional configured app or test URL whose usable origin supplies the internal default.
 * @returns {string | undefined} The HTTP(S) origin for a valid credential-free URL, or the original absent/invalid value for validation.
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

// App/test URLs are normalized before the local port default is considered.
const resolveLocalEveOrigin = (source: ReadonlyEnvironment): string => {
  let applicationUrl = source.APP_URL;
  if (typeof applicationUrl !== "string" || applicationUrl === "") {
    applicationUrl = source.PLAYWRIGHT_TEST_BASE_URL;
  }
  const origin = applicationOrigin(applicationUrl);
  if (typeof origin === "string" && origin !== "") {
    return origin;
  }
  const port = source.PORT;
  if (typeof port === "string" && port !== "") {
    return `http://localhost:${port}`;
  }
  return "http://localhost:3000";
};

// Explicit and deployment endpoints bypass app/test/local settings entirely.
const resolveEveInternalOrigin = (source: ReadonlyEnvironment): string => {
  const configuredOrigin = source.EVE_INTERNAL_ORIGIN;
  if (typeof configuredOrigin === "string" && configuredOrigin !== "") {
    return configuredOrigin;
  }
  const deploymentHost = source.VERCEL_URL;
  if (typeof deploymentHost === "string" && deploymentHost !== "") {
    return `https://${source.VERCEL_URL}`;
  }
  return resolveLocalEveOrigin(source);
};

/**
 * Only the server evaluates these defaults; no secret is a NEXT_PUBLIC value.
 * @param {ReadonlyEnvironment} source Server environment values used for explicit, deployed, app/test, and local defaults.
 * @returns {{ EVE_GATEWAY_SECRET: string | undefined; EVE_INTERNAL_ORIGIN: string; WORKFLOW_POSTGRES_URL: string | undefined; }} Gateway secret and internal/workflow endpoints with the original empty-value fallback precedence.
 */
const resolveEveEnvironment = (
  source: ReadonlyEnvironment
): {
  EVE_GATEWAY_SECRET: string | undefined;
  EVE_INTERNAL_ORIGIN: string;
  WORKFLOW_POSTGRES_URL: string | undefined;
} => ({
  EVE_GATEWAY_SECRET: source.EVE_GATEWAY_SECRET,
  EVE_INTERNAL_ORIGIN: resolveEveInternalOrigin(source),
  WORKFLOW_POSTGRES_URL: resolveWorkflowDatabaseUrl(source),
});

/**
 * EVE's PostgreSQL provider reads process.env instead of ChatJS's env object.
 * Run during agent module initialization, before EVE constructs its World.
 * @param {Environment} source Mutable server environment whose workflow URL is set to the selected nonempty PostgreSQL default.
 */

const configureWorkflowEnvironment = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This shared environment writer assigns WORKFLOW_POSTGRES_URL on the original server environment.
  source: Environment
): void => {
  const url = resolveWorkflowDatabaseUrl(source);
  if (typeof url === "string" && url !== "") {
    source.WORKFLOW_POSTGRES_URL = url;
  }
};

/**
 * Known transaction-pooler endpoints cannot support Workflow's LISTEN sessions.
 * Unknown hosts still require a direct or session connection supplied by the operator.
 * @param {string} value Parseable PostgreSQL URL to inspect for known transaction-pooling markers.
 * @returns {boolean} Whether URL flags or recognized provider host/port patterns identify an incompatible transaction pooler.
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

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (configureWorkflowEnvironment, isWorkflowTransactionPooler, resolveEveEnvironment, resolveWorkflowDatabaseUrl); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  configureWorkflowEnvironment,
  isWorkflowTransactionPooler,
  resolveEveEnvironment,
  resolveWorkflowDatabaseUrl,
};
/* oxlint-enable import/no-named-export */
