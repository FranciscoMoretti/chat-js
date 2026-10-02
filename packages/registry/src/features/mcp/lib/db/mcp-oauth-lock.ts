import postgres from "postgres";

import { databaseConnection } from "@/lib/db/connection";
import { env } from "@/lib/env";

const OAUTH_REFRESH_LOCK_TIMEOUT = "40s";
const connectionConfig = databaseConnection(env);
const lockPool = postgres(connectionConfig.url, {
  ...connectionConfig.options,
  idle_timeout: 20,
  max: Math.min(connectionConfig.options.max ?? 2, 2),
  prepare: false,
});

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
  const cancel = () => {
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
      cancelQuery = () => lock.cancel();
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
