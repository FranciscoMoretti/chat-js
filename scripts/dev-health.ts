/* oxlint-disable import/exports-last -- checkHealth: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable eslint/no-magic-numbers -- checkHealth: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
export const checkHealth = async (origin: string): Promise<void> => {
  const signal = AbortSignal.timeout(6000);
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
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/exports-last */

/* oxlint-disable node/no-process-env -- dev-health.ts: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
/* oxlint-disable eslint/no-console -- dev-health.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable typescript/strict-boolean-expressions -- dev-health.ts: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
if (import.meta.main) {
  try {
    if (!process.env.APP_URL) {
      throw new Error("Run bun dev:health from the repository root.");
    }
    await checkHealth(process.env.APP_URL);
    console.info("Healthy: ChatJS, Eve and database are ready.");
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Runtime unavailable"
    );
    process.exitCode = 1;
  }
}
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-console */
/* oxlint-enable node/no-process-env */
