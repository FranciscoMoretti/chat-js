// Drain the existing authenticated cleanup route without treating one bounded
// guest batch as a completed sweep.
const emptyCount = 0;
const batchStep = 1;
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const verifiedDeletedCount = (guests: unknown): number => {
  if (
    !isRecord(guests) ||
    typeof guests.deletedCount !== "number" ||
    !Number.isSafeInteger(guests.deletedCount) ||
    guests.deletedCount < emptyCount ||
    typeof guests.pendingCount !== "number" ||
    !Number.isSafeInteger(guests.pendingCount) ||
    guests.pendingCount < emptyCount ||
    (guests.pendingCount > emptyCount && guests.deletedCount === emptyCount) ||
    guests.skipped !== false
  ) {
    throw new Error("Cleanup inventory unavailable; retry required.");
  }
  return guests.deletedCount;
};

const deletedGuestCount = (result: unknown): number => {
  if (
    !isRecord(result) ||
    !isRecord(result.results) ||
    (result.success !== true &&
      (!isRecord(result.results.orphanedAttachments) ||
        result.results.orphanedAttachments.skipped !== false ||
        "error" in result.results.orphanedAttachments))
  ) {
    throw new Error("Cleanup incomplete or unavailable; retry required.");
  }
  return (
    verifiedDeletedCount(result.results.expiredGuests) +
    verifiedDeletedCount(result.results.runtimeGuests)
  );
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
  if (deletedGuestCount(await response.json()) > emptyCount) {
    await drainCleanup(request, remaining - batchStep);
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
