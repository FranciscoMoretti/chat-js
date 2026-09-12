import { expect, test } from "bun:test";
import { shouldRestartAfterReadinessFailures } from "./dev-recovery";

test("brief failed probes during compilation do not interrupt active requests", () => {
	expect(shouldRestartAfterReadinessFailures(3, 48_000, true)).toBe(false);
	expect(shouldRestartAfterReadinessFailures(7, 119_999, true)).toBe(false);
});

test("sustained failure still recovers the runtime after multiple observations", () => {
	expect(shouldRestartAfterReadinessFailures(7, 120_000, true)).toBe(true);
	expect(shouldRestartAfterReadinessFailures(1, 300_000, true)).toBe(false);
	expect(shouldRestartAfterReadinessFailures(0, 300_000, true)).toBe(false);
});

test("cold startup receives its full compilation grace period", () => {
	expect(shouldRestartAfterReadinessFailures(10, 179_999, false)).toBe(false);
	expect(shouldRestartAfterReadinessFailures(10, 180_000, false)).toBe(true);
});

test("repeated cold-start failures get a bounded longer chance to finish compilation", () => {
	expect(shouldRestartAfterReadinessFailures(20, 180_000, false, 1)).toBe(
		false,
	);
	expect(shouldRestartAfterReadinessFailures(30, 360_000, false, 1)).toBe(true);
	expect(shouldRestartAfterReadinessFailures(40, 599_999, false, 2)).toBe(
		false,
	);
	expect(shouldRestartAfterReadinessFailures(40, 600_000, false, 100)).toBe(
		true,
	);
	expect(shouldRestartAfterReadinessFailures(8, 120_000, true, 100)).toBe(true);
});
