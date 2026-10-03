import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { startLocalEveGuestCleanup } from "./local-guest-cleanup-scheduler";

const mocks = vi.hoisted(() => ({
  available: vi.fn(),
  cleanup: vi.fn(),
  env: {
    DATABASE_URL: "postgresql://localhost/fixture",

    EVE_GATEWAY_SECRET: "local-fixture-secret",
    NODE_ENV: "development",
  },
}));
vi.mock("../env", () => ({ env: mocks.env }));
vi.mock("./local-deletion-available", () => ({
  localDeletionAvailable: mocks.available,
}));
vi.mock("./cleanup-expired-guests", () => ({
  cleanupExpiredEveGuests: mocks.cleanup,
}));
/* oxlint-disable init-declarations --
 * init-declarations (#507): stop assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let stop: (() => void) | undefined;
/* oxlint-enable init-declarations */
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.env.NODE_ENV = "development";

  mocks.env.EVE_GATEWAY_SECRET = "local-fixture-secret";
  mocks.env.DATABASE_URL = "postgresql://localhost/fixture";
  mocks.available.mockReturnValue(true);
  mocks.cleanup.mockResolvedValue({
    deletedCount: 0,
    pendingCount: 0,
    skipped: false,
  });
});
/* oxlint-disable no-undefined, oxc/no-optional-chaining --
 * no-undefined (#519): afterEach uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-optional-chaining (#542): afterEach handles optional stop?.() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
});
/* oxlint-enable no-undefined, oxc/no-optional-chaining */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await, oxc/no-optional-chaining --
 * max-statements (#512): test("startup is singleton and sweeps never overlap") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("startup is singleton and sweeps never overlap") uses 60_000, 1, 180_000, 2, 120_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("startup is singleton and sweeps never overlap") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("startup is singleton and sweeps never overlap") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("startup is singleton and sweeps never overlap") handles optional stop?.() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
test("startup is singleton and sweeps never overlap", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.cleanup.mockImplementationOnce(async () => {
    await gate.promise;
    return { deletedCount: 0, pendingCount: 0 };
  });
  stop = startLocalEveGuestCleanup();
  expect(startLocalEveGuestCleanup()).toBe(stop);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(1);
  expect(mocks.cleanup).toHaveBeenCalledWith(process.cwd());
  await vi.advanceTimersByTimeAsync(180_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(1);
  stop?.();
  expect(startLocalEveGuestCleanup()).toBe(stop);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(1);
  gate.resolve(undefined);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  stop?.();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(2);
});
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await, oxc/no-optional-chaining */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): test.each([ { NODE_ENV: "production" }, { EVE_GATEWAY_SECRET: "" }, { DATABASE_URL: " uses 120_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test.each([ { NODE_ENV: "production" }, { EVE_GATEWAY_SECRET: "" }, { DATABASE_URL: " sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test.each([ { NODE_ENV: "production" }, { EVE_GATEWAY_SECRET: "" }, { DATABASE_URL: " accepts values; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test.each([
  { NODE_ENV: "production" },

  { EVE_GATEWAY_SECRET: "" },
  { DATABASE_URL: "postgresql://remote.example/fixture" },
  { DATABASE_URL: "https://localhost/fixture" },
])(
  "unsafe or disabled configuration never starts cleanup: %j",
  async (values) => {
    Object.assign(mocks.env, values);
    stop = startLocalEveGuestCleanup();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(stop).toBeUndefined();
  }
);
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): test("remote worker or World and a config disabled after startup cannot sweep") uses 60_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("remote worker or World and a config disabled after startup cannot sweep") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("remote worker or World and a config disabled after startup cannot sweep", async () => {
  mocks.available.mockReturnValue(false);
  expect(startLocalEveGuestCleanup()).toBeUndefined();
  mocks.available.mockReturnValue(true);
  stop = startLocalEveGuestCleanup();
  mocks.env.DATABASE_URL = "postgresql://remote.example/fixture";
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.cleanup).not.toHaveBeenCalled();
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await, oxc/no-optional-chaining --
 * max-statements (#512): test("a failed sweep retries later and stopping in flight prevents rescheduling") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a failed sweep retries later and stopping in flight prevents rescheduling") uses 120_000, 2, 60_000, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("a failed sweep retries later and stopping in flight prevents rescheduling") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("a failed sweep retries later and stopping in flight prevents rescheduling") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("a failed sweep retries later and stopping in flight prevents rescheduling") handles optional stop?.() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
test("a failed sweep retries later and stopping in flight prevents rescheduling", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {
    // Intentionally silence the expected cleanup failure in this test.
  });
  mocks.cleanup.mockRejectedValueOnce(new Error("database unavailable"));
  stop = startLocalEveGuestCleanup();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  expect(error).toHaveBeenCalledOnce();
  const gate = Promise.withResolvers<undefined>();
  mocks.cleanup.mockImplementationOnce(async () => {
    await gate.promise;
    return { deletedCount: 0, pendingCount: 0 };
  });
  await vi.advanceTimersByTimeAsync(60_000);
  stop?.();
  gate.resolve(undefined);
  await vi.advanceTimersByTimeAsync(120_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(3);
  error.mockRestore();
});
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await, oxc/no-optional-chaining */
