import { cleanupTasks } from "@/integrations/cleanup";
import { cleanupEveOrphanedFiles } from "@/lib/eve/cleanup-orphaned-files";
import type { CleanupResult, CleanupTask } from "./contracts";

const ORPHANED_ATTACHMENTS_RETENTION_TIME = 14_400_000;

export const runCleanupJob = async () => {
  const tasks: readonly CleanupTask[] = [
    {
      id: "orphanedAttachments",
      run: async () =>
        await cleanupEveOrphanedFiles(
          new Date(Date.now() - ORPHANED_ATTACHMENTS_RETENTION_TIME)
        ),
    },
    ...cleanupTasks,
  ];
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) {
    throw new Error("Cleanup tasks must have unique ids.");
  }
  const results: Record<string, CleanupResult | { error: string }> = {};
  const settled = await Promise.allSettled(
    tasks.map(async (task) => {
      const result = await task.run();
      if (
        !Number.isSafeInteger(result.deletedCount) ||
        result.deletedCount < 0 ||
        !Number.isSafeInteger(result.pendingCount ?? 0) ||
        (result.pendingCount ?? 0) < 0 ||
        typeof result.skipped !== "boolean"
      ) {
        throw new Error("Invalid cleanup inventory.");
      }
      results[task.id] = result;
      return result;
    })
  );
  for (const [index, result] of settled.entries()) {
    if (result.status === "rejected") {
      results[tasks[index].id] = { error: "Cleanup failed; retry required." };
    }
  }
  return {
    results,
    success: settled.every(
      (result) =>
        result.status === "fulfilled" &&
        !result.value.skipped &&
        (result.value.pendingCount ?? 0) === 0
    ),
    timestamp: new Date().toISOString(),
  };
};
