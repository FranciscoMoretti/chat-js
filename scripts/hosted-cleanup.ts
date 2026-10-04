// A scheduler client for the existing authenticated cleanup route. It never
// interprets an unsupported or partially completed sweep as success.
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
  const response = await fetch(new URL("/api/cron/cleanup", target), {
    headers: { authorization: `Bearer ${secret}` },
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const result: unknown = await response.json();
  if (
    !response.ok ||
    typeof result !== "object" ||
    result === null ||
    !("success" in result) ||
    result.success !== true
  ) {
    throw new Error("Cleanup incomplete or unavailable; retry required.");
  }
};

if (import.meta.main) {
  try {
    /* oxlint-disable node/no-process-env -- Scheduler entrypoint validates its two environment inputs here. */
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
