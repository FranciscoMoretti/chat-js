import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { startLocalEveGuestCleanup } from "./local-guest-cleanup-scheduler";

const mocks = vi.hoisted(() => ({
  available: vi.fn(),
  cleanup: vi.fn(),
  runtimeCleanup: vi.fn(),
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
vi.mock("./cleanup-guest-runtime", () => ({
  cleanupGuestRuntimeSessions: mocks.runtimeCleanup,
}));
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.env.NODE_ENV = "development";

  mocks.env.EVE_GATEWAY_SECRET = "local-fixture-secret";
  mocks.env.DATABASE_URL = "postgresql://localhost/fixture";
  mocks.available.mockReturnValue(true);
  mocks.runtimeCleanup.mockResolvedValue({
    deletedCount: 0,
    pendingCount: 0,
    skipped: false,
  });
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
  const gate: PromiseWithResolvers<void> = Promise.withResolvers();
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
  const workingDirectory = vi
    .spyOn(process, "cwd")
    .mockReturnValue("/refreshed-worktree");
  expect(startLocalEveGuestCleanup()).toBe(stop);
  workingDirectory.mockRestore();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(1);
  gate.resolve();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  expect(mocks.cleanup).toHaveBeenLastCalledWith("/refreshed-worktree");
  stop?.();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(2);
});

test.each([
  { NODE_ENV: "production" },

  { EVE_GATEWAY_SECRET: "" },
  { DATABASE_URL: "postgresql://remote.example/fixture" },
  { DATABASE_URL: "https://localhost/fixture" },
])(
  "unsafe or disabled configuration never starts cleanup: %j",
  async (
    values: Readonly<
      | {
          NODE_ENV: string;
          EVE_GATEWAY_SECRET?: undefined;
          DATABASE_URL?: undefined;
        }
      | {
          EVE_GATEWAY_SECRET: string;
          NODE_ENV?: undefined;
          DATABASE_URL?: undefined;
        }
      | {
          DATABASE_URL: string;
          NODE_ENV?: undefined;
          EVE_GATEWAY_SECRET?: undefined;
        }
    >
  ) => {
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
  mocks.runtimeCleanup.mockResolvedValue({
    deletedCount: 0,
    pendingCount: 0,
    skipped: false,
  });
  stop = startLocalEveGuestCleanup();
  mocks.env.DATABASE_URL = "postgresql://remote.example/fixture";
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.cleanup).not.toHaveBeenCalled();
});

test("a failed sweep retries later and stopping in flight prevents rescheduling", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {
    // Intentionally silence the expected cleanup failure in this test.
  });
  mocks.cleanup.mockRejectedValueOnce(new Error("database unavailable"));
  stop = startLocalEveGuestCleanup();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(2);
  expect(error).toHaveBeenCalledOnce();
  const gate: PromiseWithResolvers<void> = Promise.withResolvers();
  mocks.cleanup.mockImplementationOnce(async () => {
    await gate.promise;
    return { deletedCount: 0, pendingCount: 0 };
  });
  await vi.advanceTimersByTimeAsync(60_000);
  stop?.();
  gate.resolve();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(mocks.cleanup).toHaveBeenCalledTimes(3);
  error.mockRestore();
});

test("development sweeps invoke the new runtime cleanup even when legacy cleanup fails", async () => {
  mocks.cleanup.mockRejectedValueOnce(new Error("legacy failure"));
  stop = startLocalEveGuestCleanup();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.runtimeCleanup).toHaveBeenCalledOnce();
});

test("a pending runtime sweep prevents overlapping the next combined sweep", async () => {
  const gate = Promise.withResolvers<{
    deletedCount: number;
    pendingCount: number;
    skipped: boolean;
  }>();
  mocks.runtimeCleanup.mockReturnValueOnce(gate.promise);
  stop = startLocalEveGuestCleanup();
  await vi.advanceTimersByTimeAsync(240_000);
  expect(mocks.cleanup).toHaveBeenCalledOnce();
  expect(mocks.runtimeCleanup).toHaveBeenCalledOnce();
  gate.resolve({ deletedCount: 0, pendingCount: 0, skipped: false });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.runtimeCleanup).toHaveBeenCalledTimes(2);
});
