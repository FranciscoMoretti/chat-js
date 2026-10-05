import postgres from "postgres";

import { databaseConnection } from "@/lib/db/connection";
import { env } from "@/lib/env";

const OAUTH_LOCK_POOL_IDLE_TIMEOUT_SECONDS = 20;
const MAXIMUM_OAUTH_LOCK_CONNECTIONS = 2;
const OAUTH_REFRESH_LOCK_TIMEOUT = "40s";
const connectionConfig = databaseConnection(env);
const lockPool = postgres(connectionConfig.url, {
  ...connectionConfig.options,
  idle_timeout: OAUTH_LOCK_POOL_IDLE_TIMEOUT_SECONDS,
  max: Math.min(
    connectionConfig.options.max ?? MAXIMUM_OAUTH_LOCK_CONNECTIONS,
    MAXIMUM_OAUTH_LOCK_CONNECTIONS
  ),
  prepare: false,
});

type ReadonlyNativeSurface<Value> = Value extends (
  ...parameters: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? {
        readonly [Property in keyof Value]: ReadonlyNativeSurface<
          Value[Property]
        >;
      }
    : Value;
const cancelInactiveQuery = (): void => {
  // No advisory-lock query is waiting to be cancelled.
};

interface RefreshCancellation {
  readonly aborted: ReadonlyNativeSurface<Promise<never>>;
  readonly dispose: () => void;
  readonly markStarted: () => void;
  readonly resetQuery: () => void;
  readonly waitFor: <Query extends Readonly<{ cancel: () => void }>>(
    query: Query
  ) => Query;
}
const createRefreshCancellation = (
  signal?: ReadonlyNativeSurface<AbortSignal>
): RefreshCancellation => {
  const aborted = Promise.withResolvers<never>();
  let refreshStarted = false;
  let cancelQuery = cancelInactiveQuery;
  const cancel = (): void => {
    cancelQuery();
    if (!refreshStarted) {
      aborted.reject(signal?.reason);
    }
  };
  signal?.addEventListener("abort", cancel, { once: true });
  return {
    aborted: aborted.promise,
    dispose: (): void => signal?.removeEventListener("abort", cancel),
    markStarted: (): void => {
      refreshStarted = true;
    },
    resetQuery: (): void => {
      cancelQuery = cancelInactiveQuery;
    },
    waitFor: <Query extends Readonly<{ cancel: () => void }>>(
      query: Query
    ): Query => {
      cancelQuery = (): void => query.cancel();
      return query;
    },
  };
};

type LockQuery = (
  template: ReadonlyNativeSurface<TemplateStringsArray>,
  ...parameters: readonly string[]
) => ReturnType<postgres.TransactionSql>;
const createLockedRefresh =
  <Result>(
    options: Readonly<{
      cancellation: RefreshCancellation;
      connectorId: string;
      run: () => Promise<Result>;
      signal?: ReadonlyNativeSurface<AbortSignal>;
    }>
  ): ((transaction: LockQuery) => Promise<{ value: Result }>) =>
  async (transaction: LockQuery): Promise<{ value: Result }> => {
    options.signal?.throwIfAborted();
    await transaction`select set_config('lock_timeout', ${OAUTH_REFRESH_LOCK_TIMEOUT}, true)`;
    options.signal?.throwIfAborted();
    try {
      await options.cancellation.waitFor(
        transaction`select pg_advisory_xact_lock(hashtextextended(${`mcp-oauth-refresh:${options.connectorId}`}, 0))`
      );
    } finally {
      options.cancellation.resetQuery();
    }
    options.signal?.throwIfAborted();
    options.cancellation.markStarted();
    return { value: await options.run() };
  };

/** Bound refresh lock waiters separately from the app pool used by the refresh callback.
 * @param connectorId - Connector whose refresh is serialized.
 * @param run - Refresh operation performed after acquiring the database lock.
 * @param signal - Cancellation observed while waiting and before returning the result.
 * @returns The refresh operation result after lock acquisition.
 */
export const withMcpOAuthRefreshLock = async <Result>(
  connectorId: string,
  run: () => Promise<Result>,
  signal?: ReadonlyNativeSurface<AbortSignal>
): Promise<Result> => {
  signal?.throwIfAborted();
  const cancellation = createRefreshCancellation(signal);
  try {
    const operation = lockPool.begin(
      createLockedRefresh({ cancellation, connectorId, run, signal })
    );
    const result = await Promise.race([operation, cancellation.aborted]);
    signal?.throwIfAborted();
    return result.value;
  } finally {
    cancellation.dispose();
  }
};
