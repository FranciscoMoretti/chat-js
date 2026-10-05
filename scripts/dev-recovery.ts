const MAX_STARTUP_GRACE_MS = 600_000;
const INITIAL_STARTUP_GRACE_MS = 180_000;
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_EXPONENT = 2;
const READY_FAILURE_GRACE_MS = 120_000;
const MIN_READINESS_FAILURES = 3;
const NO_PREVIOUS_START_FAILURES = 0;

/* oxlint-disable eslint/max-params -- shouldRestartAfterReadinessFailures: Existing callers and library callbacks use this positional signature; changing it requires an API migration. */
/**
 * Allow cold compilation and brief resource contention before replacing a runtime.
 * @param {number} consecutiveFailures - Number of consecutive failed readiness probes.
 * @param {number} unreadyForMs - Time since readiness was lost or startup began.
 * @param {boolean} hasBeenReady - Whether this runtime has ever completed startup.
 * @param {number} failedStartups - Earlier failed starts used to increase startup grace.
 * @returns {boolean} Whether the failure count and applicable grace period require restart.
 */
export const shouldRestartAfterReadinessFailures = (
  consecutiveFailures: number,
  unreadyForMs: number,
  hasBeenReady: boolean,
  failedStartups = NO_PREVIOUS_START_FAILURES
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
/* oxlint-enable eslint/max-params */
