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
