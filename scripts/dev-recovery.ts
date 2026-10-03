const MAX_STARTUP_GRACE_MS = 600_000;
const INITIAL_STARTUP_GRACE_MS = 180_000;
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_EXPONENT = 2;
const READY_FAILURE_GRACE_MS = 120_000;
const MIN_READINESS_FAILURES = 3;

/* oxlint-disable import/prefer-default-export -- shouldRestartAfterReadinessFailures: Consumers use this named API so adding another export will not require changing existing imports. */
/* oxlint-disable import/no-named-export -- shouldRestartAfterReadinessFailures: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable eslint/max-params -- shouldRestartAfterReadinessFailures: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/* oxlint-disable eslint/no-magic-numbers -- shouldRestartAfterReadinessFailures: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable eslint/no-ternary -- shouldRestartAfterReadinessFailures: The expression preserves the existing fallback/derived-value contract within this operation. */
/**
 * Allow cold compilation and brief resource contention before replacing a runtime.
 * @param consecutiveFailures - Number of consecutive failed readiness probes.
 * @param unreadyForMs - Time since readiness was lost or startup began.
 * @param hasBeenReady - Whether this runtime has ever completed startup.
 * @param failedStartups - Earlier failed starts used to increase startup grace.
 * @returns Whether the failure count and applicable grace period require restart.
 */
export const shouldRestartAfterReadinessFailures = (
  consecutiveFailures: number,
  unreadyForMs: number,
  hasBeenReady: boolean,
  failedStartups = 0
): boolean => {
  const startupGraceMs = Math.min(
    MAX_STARTUP_GRACE_MS,
    INITIAL_STARTUP_GRACE_MS *
      BACKOFF_MULTIPLIER ** Math.min(MAX_BACKOFF_EXPONENT, failedStartups)
  );
  return (
    consecutiveFailures >= MIN_READINESS_FAILURES &&
    unreadyForMs >= (hasBeenReady ? READY_FAILURE_GRACE_MS : startupGraceMs)
  );
};
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-params */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
