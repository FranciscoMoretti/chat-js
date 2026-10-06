const HEALTH_CHECK_TIMEOUT_MS = 6000;
const EMPTY_URL_LENGTH = 0;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve checkHealth's awaited sequencing and rejected-Promise behavior. */
const checkHealth = async (origin: string): Promise<void> => {
  const signal = AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS);
  await Promise.all([
    (async (): Promise<void> => {
      const response = await fetch(new URL("/api/health", origin), {
        redirect: "error",
        signal,
      });
      if (!response.ok) {
        throw new Error(`Readiness returned HTTP ${response.status}`);
      }
      const body: unknown = await response.json();
      if (
        typeof body !== "object" ||
        body === null ||
        !("status" in body) ||
        body.status !== "ready"
      ) {
        throw new Error("Invalid readiness response");
      }
    })(),
    (async (): Promise<void> => {
      // No cookie: Better Auth returns null without looking up a database session.
      // Exercise a dynamic route as well as the static infrastructure endpoint.
      const response = await fetch(new URL("/api/auth/get-session", origin), {
        redirect: "error",
        signal,
      });
      if (!response.ok) {
        throw new Error(
          `Authentication route returned HTTP ${response.status}`
        );
      }
      if ((await response.json()) !== null) {
        throw new Error("Invalid unauthenticated session response");
      }
    })(),
  ]);
};
/* oxlint-enable oxc/no-async-await */
if (import.meta.main) {
  try {
    // oxlint-disable-next-line node/no-process-env -- Read the configured readiness origin at this CLI boundary.
    const appUrl = process.env.APP_URL;
    if (typeof appUrl !== "string" || appUrl.length === EMPTY_URL_LENGTH) {
      throw new Error("Run bun dev:health from the repository root.");
    }
    // oxlint-disable-next-line node/no-top-level-await -- This Bun command awaits readiness checks before printing success or handling their failure.
    await checkHealth(appUrl);
    // oxlint-disable-next-line eslint/no-console -- Preserve the command's successful readiness message.
    console.info("Healthy: ChatJS, Eve and database are ready.");
  } catch (error) {
    // oxlint-disable-next-line eslint/no-console -- Preserve the command's operator-facing failure diagnostic.
    console.error(
      // oxlint-disable-next-line no-ternary -- Keep console.error argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      error instanceof Error ? error.message : "Runtime unavailable"
    );
    process.exitCode = 1;
  }
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (checkHealth); the enabled import/no-default-export convention rejects the default-export alternative. */
export { checkHealth };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
