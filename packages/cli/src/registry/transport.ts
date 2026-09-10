/** A process-local network policy around shadcn's native fetch calls.
 * shadcn still owns requests, authentication, redirects, caching and resolution.
 * Serialize operations so this temporary host policy cannot leak between calls.
 */
let pending: Promise<void> = Promise.resolve();
function requireSecure(url: string, redirect = false) {
	const parsed = new URL(url);
	if (parsed.protocol === "https:") return;
	if (
		!redirect &&
		parsed.protocol === "http:" &&
		["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
	)
		return;
	throw new Error(
		"Registry requests must use HTTPS (HTTP is allowed only on loopback, without redirects).",
	);
}
export function withRegistryTransport<T>(
	operation: () => Promise<T>,
): Promise<T> {
	const run = async () => {
		const original = globalThis.fetch;
		globalThis.fetch = new Proxy(original, {
			apply(target, receiver, args: Parameters<typeof fetch>) {
				const input = args[0];
				const url = input instanceof Request ? input.url : String(input);
				requireSecure(url);
				return Reflect.apply(target, receiver, args).then(
					(response: Response) => {
						const location = response.headers.get("location");
						if (response.status >= 300 && response.status < 400 && location)
							requireSecure(new URL(location, url).href, true);
						return response;
					},
				);
			},
		});
		try {
			return await operation();
		} finally {
			globalThis.fetch = original;
		}
	};
	const result = pending.then(run);
	pending = result.then(
		() => {},
		() => {},
	);
	return result;
}
