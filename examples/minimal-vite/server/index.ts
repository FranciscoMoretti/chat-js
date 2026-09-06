import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { gateway } from "./gateway";
import { trpc } from "./trpc";

// Bounded Node-to-Fetch seam. Keep auth/ACL and typed tRPC contracts unchanged.
const server = createServer(async (incoming, outgoing) => {
	const controller = new AbortController();
	incoming.on("aborted", () => controller.abort());
	outgoing.on("close", () => {
		if (!outgoing.writableEnded) controller.abort();
	});
	try {
		const headers = new Headers();
		for (const [key, value] of Object.entries(incoming.headers)) {
			if (Array.isArray(value))
				for (const item of value) headers.append(key, item);
			else if (value !== undefined) headers.set(key, value);
		}
		const method = incoming.method ?? "GET";
		const url = new URL(incoming.url ?? "/", "http://internal");
		const init: RequestInit & { duplex?: "half" } = {
			method,
			headers,
			signal: controller.signal,
		};
		if (method !== "GET" && method !== "HEAD") {
			const iterator = incoming[Symbol.asyncIterator]();
			let bytes = 0;
			init.body = new ReadableStream<Uint8Array>({
				async pull(stream) {
					const next = await iterator.next();
					if (next.done) return stream.close();
					if (!Buffer.isBuffer(next.value))
						throw Error("Expected request bytes");
					bytes += next.value.length;
					if (bytes > 1_048_576) throw Error("Request body too large");
					stream.enqueue(next.value);
				},
				cancel() {
					incoming.destroy();
				},
			});
			init.duplex = "half";
		}
		const request = new Request(url, init);
		let response: Response;
		if (
			url.pathname.startsWith("/api/trpc/") &&
			["GET", "POST"].includes(method)
		)
			response = await trpc(request);
		else if (
			url.pathname.startsWith("/api/eve/") &&
			["GET", "POST"].includes(method)
		)
			response = await gateway(
				request,
				url.pathname.slice("/api/eve/".length).split("/"),
			);
		else response = new Response(null, { status: 404 });
		outgoing.writeHead(response.status, Object.fromEntries(response.headers));
		outgoing.flushHeaders();
		if (response.body) {
			const reader = response.body.getReader();
			async function* chunks() {
				try {
					while (true) {
						const next = await reader.read();
						if (next.done) return;
						yield next.value;
					}
				} finally {
					await reader.cancel();
				}
			}
			await pipeline(Readable.from(chunks()), outgoing);
		} else outgoing.end();
	} catch {
		if (controller.signal.aborted) return;
		if (!outgoing.headersSent)
			outgoing.writeHead(502, { "cache-control": "no-store" });
		outgoing.end();
	}
});
server.listen(Number(process.env.PORT), "127.0.0.1", () =>
	console.log("Application gateway ready"),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
	process.on(signal, () => server.close(() => process.exit(0)));
