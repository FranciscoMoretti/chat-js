export async function checkHealth(origin: string) {
	const response = await fetch(new URL("/api/health", origin), {
		signal: AbortSignal.timeout(6000),
		redirect: "error",
	});
	if (!response.ok)
		throw new Error(`Readiness returned HTTP ${response.status}`);
	const body = await response.json();
	if (body.status !== "ready") throw new Error("Invalid readiness response");
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
