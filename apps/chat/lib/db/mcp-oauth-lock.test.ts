import { beforeEach, expect, it, vi } from "vitest";

import { withMcpOAuthRefreshLock } from "./mcp-oauth-lock";

const mocks = vi.hoisted(() => ({ begin: vi.fn(), released: vi.fn() }));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("postgres")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("postgres", () => ({
  default: () => ({ begin: mocks.begin }),
}));
/* oxlint-enable typescript/explicit-function-return-type */
vi.mock("@/lib/env", () => ({ env: {} }));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/db/connection")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/db/connection", () => ({
  databaseConnection: () => ({ options: {}, url: "postgres://test" }),
}));
/* oxlint-enable typescript/explicit-function-return-type */

beforeEach(() => vi.clearAllMocks());

/* oxlint-disable max-statements, typescript/promise-function-async --
 * max-statements (#512): it("cancellation after lock acquisition waits for the active refresh to finish and re keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/promise-function-async (#606): it("cancellation after lock acquisition waits for the active refresh to finish and re preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
    // oxlint-disable-next-line promise/always-return, promise/prefer-await-to-then -- Observe settlement without awaiting or adding a value; the test must inspect the still-pending refresh.
    .then(() => {
      settled = true;
    })
    // oxlint-disable-next-line promise/prefer-await-to-then -- Observe rejection without awaiting the refresh; intermediate settlement is the behavior under test.
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
/* oxlint-enable max-statements, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): it("cancellation while acquiring the lock cancels the query and never starts refresh  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("cancellation while acquiring the lock cancels the query and never starts refresh  uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable max-statements, no-magic-numbers */
