import { beforeEach, expect, test, vi } from "vitest";
import { cleanupTasks } from "@/integrations/cleanup";
import { runCleanupJob } from "./job";

const tasks = vi.hoisted(() => ({
  attachments: vi.fn(),
  runtime: vi.fn(),
}));
vi.mock("@/lib/eve/cleanup-orphaned-files", () => ({
  cleanupEveOrphanedFiles: tasks.attachments,
}));
vi.mock("@/integrations/cleanup", () => ({
  cleanupTasks: [{ id: "example", run: tasks.runtime }],
}));
beforeEach(() => {
  vi.resetAllMocks();
  tasks.attachments.mockResolvedValue({ deletedCount: 2, skipped: false });
  tasks.runtime.mockResolvedValue({
    deletedCount: 3,
    pendingCount: 0,
    skipped: false,
  });
});

test.each(["attachments", "runtime"] as const)(
  "a failed %s task does not prevent other cleanup or expose its error",
  async (failedTask) => {
    tasks[failedTask].mockRejectedValue(
      new Error("private provider credential")
    );
    const result = await runCleanupJob();
    expect(result.success).toBe(false);
    expect(tasks.attachments).toHaveBeenCalledOnce();
    expect(tasks.runtime).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain("private provider credential");
  }
);

test("reports counts when every task completes", async () => {
  const result = await runCleanupJob();
  expect(result.success).toBe(true);
  expect(result.results).toEqual({
    orphanedAttachments: { deletedCount: 2, skipped: false },
    example: { deletedCount: 3, pendingCount: 0, skipped: false },
  });
});

test.each([
  { pendingCount: 1, skipped: false },
  { pendingCount: 0, skipped: true },
])("incomplete work remains retryable: %o", async (state) => {
  tasks.runtime.mockResolvedValue({ deletedCount: 0, ...state });
  const result = await runCleanupJob();
  expect(result.success).toBe(false);
});

test("skipped attachment cleanup remains retryable", async () => {
  tasks.attachments.mockResolvedValue({ deletedCount: 0, skipped: true });
  const result = await runCleanupJob();
  expect(result.success).toBe(false);
});

test.each([
  { deletedCount: -1 },
  { deletedCount: Number.NaN },
  { pendingCount: -1 },
])("invalid task inventory cannot report success: %o", async (value) => {
  tasks.runtime.mockResolvedValue({
    deletedCount: 0,
    pendingCount: 0,
    skipped: false,
    ...value,
  });
  const result = await runCleanupJob();
  expect(result.success).toBe(false);
});

test("duplicate app-owned cleanup ids fail before any side effects", async () => {
  cleanupTasks.push({ id: "orphanedAttachments", run: tasks.runtime });
  try {
    await expect(runCleanupJob()).rejects.toThrow("unique ids");
    expect(tasks.attachments).not.toHaveBeenCalled();
    expect(tasks.runtime).not.toHaveBeenCalled();
  } finally {
    cleanupTasks.pop();
  }
});
