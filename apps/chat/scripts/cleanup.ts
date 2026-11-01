// Drain the existing authenticated cleanup route without treating one bounded
// cleanup batch as a completed sweep.
const emptyCount = 0;
const batchStep = 1;
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const verifiedDeletedCount = (inventory: unknown): number => {
  if (
    !isRecord(inventory) ||
    typeof inventory.deletedCount !== "number" ||
    !Number.isSafeInteger(inventory.deletedCount) ||
    inventory.deletedCount < emptyCount ||
    typeof inventory.pendingCount !== "number" ||
    !Number.isSafeInteger(inventory.pendingCount) ||
    inventory.pendingCount < emptyCount ||
    (inventory.pendingCount > emptyCount &&
      inventory.deletedCount === emptyCount) ||
    inventory.skipped !== false
  ) {
    throw new Error("Cleanup inventory unavailable; retry required.");
  }
  return inventory.deletedCount;
};

const deletedCount = (result: unknown): number => {
  if (
    !isRecord(result) ||
    !isRecord(result.results) ||
    typeof result.success !== "boolean"
  ) {
    throw new Error("Cleanup incomplete or unavailable; retry required.");
  }
  let total = 0;
  for (const task of Object.values(result.results)) {
    if (!isRecord(task) || "error" in task) {
      throw new Error("Cleanup failed; retry required.");
    }
    total += verifiedDeletedCount({
      ...task,
      pendingCount: task.pendingCount ?? 0,
    });
  }
  return total;
};

const drainCleanup = async (
  request: () => Promise<Response>,
  remaining: number
): Promise<void> => {
  if (remaining === emptyCount) {
    throw new Error("Cleanup batch limit reached; retry required.");
  }
  const response = await request();
  // A partial sweep uses 503. Continue only when its validated inventory shows
  // progress; a stalled batch still fails and keeps its durable retry records.
  if (!response.ok && response.status !== 503) {
    throw new Error("Cleanup incomplete or unavailable; retry required.");
  }
  if (deletedCount(await response.json()) > emptyCount) {
    await drainCleanup(request, remaining - batchStep);
    return;
  }
  if (!response.ok) {
    throw new Error("Cleanup stalled; retry required.");
  }
};
const runHostedCleanup = async (
  origin: string,
  secret: string
): Promise<void> => {
  const target = new URL(origin);
  if (
    target.protocol !== "https:" ||
    target.username !== "" ||
    target.password !== "" ||
    target.pathname !== "/" ||
    target.search !== "" ||
    target.hash !== "" ||
    secret.trim() === ""
  ) {
    throw new Error("Set an HTTPS APP_URL origin and nonempty CRON_SECRET.");
  }
  const timeoutMs = 120_000;
  const maxBatches = 100;
  const signal = AbortSignal.timeout(timeoutMs);
  await drainCleanup(
    async () =>
      await fetch(new URL("/api/cron/cleanup", target), {
        headers: { authorization: `Bearer ${secret}` },
        redirect: "error",
        signal,
      }),
    maxBatches
  );
};
if (import.meta.main) {
  try {
    await runHostedCleanup(
      process.env.APP_URL ?? "",
      process.env.CRON_SECRET ?? ""
    );
  } catch {
    // Never log response payloads, URLs, fetch causes or bearer credentials.
    process.stderr.write(
      "Hosted cleanup failed; inspect the protected application logs and retry.\n"
    );
    process.exitCode = 1;
  }
}

export { runHostedCleanup };
