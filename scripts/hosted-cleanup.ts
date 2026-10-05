// Drain the existing authenticated cleanup route without treating one bounded
// guest batch as a completed sweep.
const emptyCount = 0;
const batchStep = 1;
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const deletedGuestCount = (result: unknown): number => {
  if (
    !isRecord(result) ||
    result.success !== true ||
    !isRecord(result.results) ||
    !isRecord(result.results.expiredGuests)
  ) {
    throw new Error("Cleanup incomplete or unavailable; retry required.");
  }
  const guests = result.results.expiredGuests;
  if (
    typeof guests.deletedCount !== "number" ||
    !Number.isSafeInteger(guests.deletedCount) ||
    guests.deletedCount < emptyCount ||
    guests.pendingCount !== emptyCount ||
    guests.skipped !== false
  ) {
    throw new Error("Cleanup inventory unavailable; retry required.");
  }
  return guests.deletedCount;
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve drainCleanup's awaited sequencing and rejected-Promise behavior. */
const drainCleanup = async (
  request: () => Promise<Response>,
  remaining: number
): Promise<void> => {
  if (remaining === emptyCount) {
    throw new Error("Cleanup batch limit reached; retry required.");
  }
  const response = await request();
  if (!response.ok) {
    throw new Error("Cleanup incomplete or unavailable; retry required.");
  }
  if (deletedGuestCount(await response.json()) > emptyCount) {
    await drainCleanup(request, remaining - batchStep);
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve runHostedCleanup's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
if (import.meta.main) {
  try {
    /* oxlint-disable node/no-process-env -- Scheduler entrypoint validates its two environment inputs here. */
    // oxlint-disable-next-line node/no-top-level-await -- This scheduler executable awaits cleanup so its existing catch reports network or authorization failures.
    await runHostedCleanup(
      process.env.APP_URL ?? "",
      process.env.CRON_SECRET ?? ""
    );
    /* oxlint-enable node/no-process-env */
  } catch {
    // Never log response payloads, URLs, fetch causes or bearer credentials.
    process.stderr.write(
      "Hosted cleanup failed; inspect the protected application logs and retry.\n"
    );
    process.exitCode = 1;
  }
}

export { runHostedCleanup };
