export async function checkHealth(origin: string) {
	const signal = AbortSignal.timeout(6000);
	await Promise.all([
		(async () => {
			const response = await fetch(new URL("/api/health", origin), {
				signal,
				redirect: "error",
			});
			if (!response.ok)
				throw new Error(`Readiness returned HTTP ${response.status}`);
			const body = await response.json();
			if (body.status !== "ready")
				throw new Error("Invalid readiness response");
		})(),
		(async () => {
			// No cookie: Better Auth returns null without looking up a database session.
			// Exercise a dynamic route as well as the static infrastructure endpoint.
			const response = await fetch(new URL("/api/auth/get-session", origin), {
				signal,
				redirect: "error",
			});
			if (!response.ok)
				throw new Error(
					`Authentication route returned HTTP ${response.status}`,
				);
			if ((await response.json()) !== null)
				throw new Error("Invalid unauthenticated session response");
		})(),
	]);
}

if (import.meta.main) {
	try {
		if (!process.env.APP_URL)
			throw new Error("Run bun dev:health from the repository root.");
		await checkHealth(process.env.APP_URL);
		console.info("Healthy: ChatJS, Eve and database are ready.");
	} catch (error) {
		console.error(
			error instanceof Error ? error.message : "Runtime unavailable",
		);
		process.exitCode = 1;
	}
}
