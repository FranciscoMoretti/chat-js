import { resolveWorkflowWorld } from "./world-config";

type Environment = Record<string, string | undefined>;

/* oxlint-disable import/exports-last, import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/exports-last (#522): resolveWorkflowDatabaseUrl is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): resolveWorkflowDatabaseUrl stays exported at its declaration so its public contract is visible beside its implementation.
 * no-undefined (#519): resolveWorkflowDatabaseUrl uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep resolveWorkflowDatabaseUrl's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep resolveWorkflowDatabaseUrl's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): resolveWorkflowDatabaseUrl accepts source: Environment; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): resolveWorkflowDatabaseUrl intentionally keeps the existing falsy-value behavior of source.WORKFLOW_POSTGRES_URL; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const resolveWorkflowDatabaseUrl = (source: Environment) =>
  resolveWorkflowWorld(source) === "vercel"
    ? undefined
    : // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
      source.WORKFLOW_POSTGRES_URL || source.DATABASE_URL;
/* oxlint-enable import/exports-last, import/group-exports, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): applicationOrigin's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): applicationOrigin's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep applicationOrigin's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): applicationOrigin intentionally keeps the existing falsy-value behavior of value; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Strip app/test URL paths only after checking the scheme and credentials.
 * Preserve invalid input so runtime and CLI schema validation can reject it. */
const applicationOrigin = (value: string | undefined) => {
  if (!value || !URL.canParse(value)) {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): resolveEveEnvironment stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): resolveEveEnvironment's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): resolveEveEnvironment's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep resolveEveEnvironment's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep resolveEveEnvironment's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): resolveEveEnvironment accepts source: Environment; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): resolveEveEnvironment intentionally keeps the existing falsy-value behavior of source.EVE_INTERNAL_ORIGIN; source.VERCEL_URL; applicationOrigin(source.APP_URL || source.PLAYWRIGHT_TEST_BASE_URL); source.APP_URL; source.PORT; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Only the server evaluates these defaults; no secret is a NEXT_PUBLIC value. */
export const resolveEveEnvironment = (source: Environment) => ({
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): configureWorkflowEnvironment stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): configureWorkflowEnvironment's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/prefer-readonly-parameter-types (#565): configureWorkflowEnvironment accepts source: Environment; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): configureWorkflowEnvironment intentionally keeps the existing falsy-value behavior of url; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** EVE's PostgreSQL provider reads process.env instead of ChatJS's env object.
 * Run during agent module initialization, before EVE constructs its World. */
export const configureWorkflowEnvironment = (source: Environment): void => {
  const url = resolveWorkflowDatabaseUrl(source);
  if (url) {
    source.WORKFLOW_POSTGRES_URL = url;
  }
};
/* oxlint-enable import/group-exports, jsdoc/require-param, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns --
 * import/group-exports (#523): isWorkflowTransactionPooler stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): isWorkflowTransactionPooler's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): isWorkflowTransactionPooler's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 */
/** Known transaction-pooler endpoints cannot support Workflow's LISTEN sessions.
 * Unknown hosts still require a direct or session connection supplied by the operator. */
export const isWorkflowTransactionPooler = (value: string): boolean => {
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns */
