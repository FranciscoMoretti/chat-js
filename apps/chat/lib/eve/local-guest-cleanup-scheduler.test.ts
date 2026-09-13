import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { startLocalEveGuestCleanup } from "./local-guest-cleanup-scheduler";

const mocks = vi.hoisted(() => ({
  available: vi.fn(),
  cleanup: vi.fn(),
  env: {
    DATABASE_URL: "postgresql://localhost/fixture",
    EVE_ENABLED: "true",
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
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.env.NODE_ENV = "development";
  mocks.env.EVE_ENABLED = "true";
  mocks.env.EVE_GATEWAY_SECRET = "local-fixture-secret";
  mocks.env.DATABASE_URL = "postgresql://localhost/fixture";
  mocks.available.mockReturnValue(true);
  mocks.cleanup.mockResolvedValue({
    deletedCount: 0,
    pendingCount: 0,
    skipped: false,
  });
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
});

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

test.each([
  { NODE_ENV: "production" },
  { EVE_ENABLED: "false" },
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

test("remote worker or World and a config disabled after startup cannot sweep", async () => {
  mocks.available.mockReturnValue(false);
  expect(startLocalEveGuestCleanup()).toBeUndefined();
  mocks.available.mockReturnValue(true);
  stop = startLocalEveGuestCleanup();
  mocks.env.DATABASE_URL = "postgresql://remote.example/fixture";
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.cleanup).not.toHaveBeenCalled();
});

test("a failed sweep retries later and stopping in flight prevents rescheduling", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
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
