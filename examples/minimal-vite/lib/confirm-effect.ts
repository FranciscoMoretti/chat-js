import { setTimeout } from "node:timers/promises";
import { required } from "./env";
import { noteOutput } from "./note-contract";

// This fixture's receiver owns idempotency; Eve/Workflow retries are not an
// exactly-once guarantee. The key comes from durable execution, not model text.
export async function confirmEffect(
	key: string,
	note: string,
	signal: AbortSignal,
) {
	let lastError: unknown;
	for (let attempt = 0; attempt < 30; attempt++) {
		signal.throwIfAborted();
		try {
			const result = await fetch(
				new URL("/notes", required("SIDE_EFFECT_ORIGIN")),
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${required("SIDE_EFFECT_SECRET")}`,
					},
					body: JSON.stringify({ key, note }),
					signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
				},
			);
			if (result.ok) return noteOutput.parse(await result.json());
			if (result.status < 500)
				throw new PermanentEffectError(`Receiver rejected: ${result.status}`);
			lastError = new Error(`Receiver unavailable: ${result.status}`);
		} catch (error) {
			if (error instanceof PermanentEffectError) throw error;
			lastError = error;
		}
		await setTimeout(1000, undefined, { signal });
	}
	throw lastError;
}
class PermanentEffectError extends Error {}
