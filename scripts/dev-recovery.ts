/** Allow cold compilation and brief resource contention to finish before replacing a live runtime. */
export function shouldRestartAfterReadinessFailures(
	consecutiveFailures: number,
	unreadyForMs: number,
	hasBeenReady: boolean,
	failedStartups = 0,
) {
	const startupGraceMs = Math.min(
		600_000,
		180_000 * 2 ** Math.min(2, failedStartups),
	);
	return (
		consecutiveFailures >= 3 &&
		unreadyForMs >= (hasBeenReady ? 120_000 : startupGraceMs)
	);
}
