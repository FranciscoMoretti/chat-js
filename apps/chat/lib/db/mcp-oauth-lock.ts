import postgres from "postgres";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { databaseConnection } from "@/lib/db/connection";
/* oxlint-enable sort-imports */
import { env } from "@/lib/env";

const OAUTH_LOCK_POOL_IDLE_TIMEOUT_SECONDS = 20;
const MAXIMUM_OAUTH_LOCK_CONNECTIONS = 2;
const OAUTH_REFRESH_LOCK_TIMEOUT = "40s";
const connectionConfig = databaseConnection(env);
const lockPool = postgres(connectionConfig.url, {
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connectionConfig.options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...connectionConfig.options,
  idle_timeout: OAUTH_LOCK_POOL_IDLE_TIMEOUT_SECONDS,
  max: Math.min(
    connectionConfig.options.max ?? MAXIMUM_OAUTH_LOCK_CONNECTIONS,
    MAXIMUM_OAUTH_LOCK_CONNECTIONS
  ),
  prepare: false,
});

type ReadonlyNativeSurface<Value> = Value extends
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
  ? Value
  : Value extends (...parameters: readonly never[]) => unknown
    ? Value
    : Value extends abstract new (...parameters: readonly never[]) => unknown
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Cancel listener is registered only for a supplied signal; runtime event admission implies presence, but removing this optional access alone fails TS narrowing across the callback. Splitting cancellation state solely for the rule adds complexity; preserve rejection reason and query-cancel ordering.
      aborted.reject(signal?.reason);
    }
  };
  // oxlint-disable-next-line oxc/no-optional-chaining -- Public signal is optional; without it refresh still runs and no cancellation listener is registered.
  signal?.addEventListener("abort", cancel, { once: true });
  return {
    aborted: aborted.promise,
    // oxlint-disable-next-line oxc/no-optional-chaining -- Dispose executes even when no signal was supplied; it must remain a no-op in that case.
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createLockedRefresh's awaited sequencing and rejected-Promise behavior. */
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Public optional signal is checked before lock setup, after each awaited lock step, and after the operation race; no prior optional call establishes a signal-presence guard.
    options.signal?.throwIfAborted();
    await transaction`select set_config('lock_timeout', ${OAUTH_REFRESH_LOCK_TIMEOUT}, true)`;
    // oxlint-disable-next-line oxc/no-optional-chaining -- Public optional signal is checked before lock setup, after each awaited lock step, and after the operation race; no prior optional call establishes a signal-presence guard.
    options.signal?.throwIfAborted();
    try {
      await options.cancellation.waitFor(
        transaction`select pg_advisory_xact_lock(hashtextextended(${`mcp-oauth-refresh:${options.connectorId}`}, 0))`
      );
    } finally {
      options.cancellation.resetQuery();
    }
    // oxlint-disable-next-line oxc/no-optional-chaining -- Public optional signal is checked before lock setup, after each awaited lock step, and after the operation race; no prior optional call establishes a signal-presence guard.
    options.signal?.throwIfAborted();
    options.cancellation.markStarted();
    return { value: await options.run() };
  };
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (withMcpOAuthRefreshLock); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve withMcpOAuthRefreshLock's awaited sequencing and rejected-Promise behavior. */
/** Bound refresh lock waiters separately from the app pool used by the refresh callback.
 * @param {string} connectorId - Connector whose refresh is serialized.
 * @param {() => Promise<Result>} run - Refresh operation performed after acquiring the database lock.
 * @param {ReadonlyNativeSurface<AbortSignal> | undefined} signal - Cancellation observed while waiting and before returning the result.
 * @returns {Promise<Result>} The refresh operation result after lock acquisition.
 */
export const withMcpOAuthRefreshLock = async <Result>(
  connectorId: string,
  run: () => Promise<Result>,
  signal?: ReadonlyNativeSurface<AbortSignal>
): Promise<Result> => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Public optional signal is checked before lock setup, after each awaited lock step, and after the operation race; no prior optional call establishes a signal-presence guard.
  signal?.throwIfAborted();
  const cancellation = createRefreshCancellation(signal);
  try {
    const operation = lockPool.begin(
      createLockedRefresh({ cancellation, connectorId, run, signal })
    );
    const result = await Promise.race([operation, cancellation.aborted]);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Public optional signal is checked before lock setup, after each awaited lock step, and after the operation race; no prior optional call establishes a signal-presence guard.
    signal?.throwIfAborted();
    return result.value;
  } finally {
    cancellation.dispose();
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
