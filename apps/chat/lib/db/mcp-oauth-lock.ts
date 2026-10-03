import postgres from "postgres";

import { databaseConnection } from "@/lib/db/connection";
import { env } from "@/lib/env";

const OAUTH_REFRESH_LOCK_TIMEOUT = "40s";
const connectionConfig = databaseConnection(env);
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const lockPool = postgres(connectionConfig.url, {
  ...connectionConfig.options,
  idle_timeout: 20,
  max: Math.min(connectionConfig.options.max ?? 2, 2),
  prepare: false,
});
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** Bound refresh lock waiters separately from the app pool used by the refresh callback. */
export const withMcpOAuthRefreshLock = async <T>(
  connectorId: string,
  run: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> => {
  signal?.throwIfAborted();
  const aborted = Promise.withResolvers<never>();
  let refreshStarted = false;
  let cancelQuery: (() => void) | undefined;
  const cancel = (): void => {
    cancelQuery?.();
    if (!refreshStarted) {
      aborted.reject(signal?.reason);
    }
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const operation = lockPool.begin(async (transaction) => {
      signal?.throwIfAborted();
      await transaction`select set_config('lock_timeout', ${OAUTH_REFRESH_LOCK_TIMEOUT}, true)`;
      signal?.throwIfAborted();
      const lock = transaction`select pg_advisory_xact_lock(hashtextextended(${`mcp-oauth-refresh:${connectorId}`}, 0))`;
      cancelQuery = (): void => lock.cancel();
      try {
        await lock;
      } finally {
        cancelQuery = undefined;
      }
      signal?.throwIfAborted();
      refreshStarted = true;
      return { value: await run() };
    });
    const result = await Promise.race([operation, aborted.promise]);
    signal?.throwIfAborted();
    return result.value;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/id-length */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable eslint/max-statements */
