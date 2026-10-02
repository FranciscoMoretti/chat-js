import { beforeEach, expect, it, vi } from "vitest";

import { withMcpOAuthRefreshLock } from "./mcp-oauth-lock";

const mocks = vi.hoisted(() => ({ begin: vi.fn(), released: vi.fn() }));
vi.mock("postgres", () => ({
  default: () => ({ begin: mocks.begin }),
}));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/db/connection", () => ({
  databaseConnection: () => ({ options: {}, url: "postgres://test" }),
}));

beforeEach(() => vi.clearAllMocks());

it("cancellation after lock acquisition waits for the active refresh to finish and release the transaction", async () => {
  mocks.begin.mockImplementation(
    async (run: (transaction: unknown) => Promise<unknown>) => {
      try {
        return await run(vi.fn().mockResolvedValue([]));
      } finally {
        mocks.released();
      }
    }
  );
  const gate = Promise.withResolvers<string>();
  const refresh = vi.fn(() => gate.promise);
  const controller = new AbortController();
  const pending = withMcpOAuthRefreshLock(
    "connector",
    refresh,
    controller.signal
  );
  let settled = false;
  const rejected = expect(pending).rejects.toThrow("cancelled");
  pending
    .then(() => {
      settled = true;
    })
    .catch(() => {
      settled = true;
    });
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  controller.abort(new Error("cancelled"));
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(mocks.released).not.toHaveBeenCalled();
  gate.resolve("saved");
  await rejected;
  expect(mocks.released).toHaveBeenCalledOnce();
});

it("cancellation while acquiring the lock cancels the query and never starts refresh work", async () => {
  const lock = Promise.withResolvers<unknown[]>();
  const controller = new AbortController();
  const cancel = vi.fn(() => lock.reject(controller.signal.reason));
  const query = Object.assign(lock.promise, { cancel });
  const transaction = vi
    .fn()
    .mockResolvedValueOnce([])
    .mockReturnValueOnce(query);
  mocks.begin.mockImplementation(
    async (run: (transaction: unknown) => Promise<unknown>) => {
      try {
        return await run(transaction);
      } finally {
        mocks.released();
      }
    }
  );
  const refresh = vi.fn();
  const result = withMcpOAuthRefreshLock(
    "connector",
    refresh,
    controller.signal
  );
  const rejected = expect(result).rejects.toThrow("cancelled acquisition");
  await vi.waitFor(() => expect(transaction).toHaveBeenCalledTimes(2));
  controller.abort(new Error("cancelled acquisition"));
  await rejected;
  await vi.waitFor(() => expect(mocks.released).toHaveBeenCalledOnce());
  expect(cancel).toHaveBeenCalledOnce();
  expect(refresh).not.toHaveBeenCalled();
});
