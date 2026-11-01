import { expect, test, vi } from "vitest";
import { withTaskCleanup } from "./task-cleanup";

test("cleanup precedes settlement on successful and rejected tasks", async () => {
  const events: string[] = [];
  const cleanup = (): void => {
    events.push("cleanup");
  };
  expect(
    await withTaskCleanup(vi.fn().mockResolvedValue("saved"), cleanup)
  ).toBe("saved");
  const failure = new Error("operation failed");
  await expect(
    withTaskCleanup(vi.fn().mockRejectedValue(failure), cleanup)
  ).rejects.toBe(failure);
  expect(events).toEqual(["cleanup", "cleanup"]);
});

test("asynchronous cleanup is awaited and a cleanup failure replaces task failure", async () => {
  const pending = Promise.withResolvers<string>();
  const settled = vi.fn();
  const completion = withTaskCleanup(
    vi.fn().mockResolvedValue("saved"),
    async () => {
      await pending.promise;
    }
  );
  void completion.then(settled);
  expect(settled).not.toHaveBeenCalled();
  pending.resolve("released");
  expect(await completion).toBe("saved");
  const failure = new Error("cleanup failed");
  await expect(
    withTaskCleanup(
      vi.fn().mockRejectedValue(new Error("task failed")),
      vi.fn().mockRejectedValue(failure)
    )
  ).rejects.toBe(failure);
});
