const HEALTH_CHECK_TIMEOUT_MS = 6000;
const EMPTY_URL_LENGTH = 0;

const checkHealth = async (
  origin: string,
  cancellation?: AbortSignal
): Promise<void> => {
  const timeout = AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS);
  const signal = cancellation
    ? AbortSignal.any([cancellation, timeout])
    : timeout;
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
if (import.meta.main) {
  try {
    const appUrl = process.env.APP_URL;
    if (typeof appUrl !== "string" || appUrl.length === EMPTY_URL_LENGTH) {
      throw new Error("Run bun dev:health from the repository root.");
    }
    await checkHealth(appUrl);
    console.info("Healthy: ChatJS, Eve and database are ready.");
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Runtime unavailable"
    );
    process.exitCode = 1;
  }
}
export { checkHealth };
