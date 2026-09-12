/** Allow cold compilation and brief resource contention to finish before replacing a live runtime. */
export function shouldRestartAfterReadinessFailures(
	consecutiveFailures: number,
	unreadyForMs: number,
	hasBeenReady: boolean,
) {
	return (
		consecutiveFailures >= 3 &&
		unreadyForMs >= (hasBeenReady ? 120_000 : 180_000)
	);
}
