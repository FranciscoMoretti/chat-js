import { inputResponseSchema } from "eve/client";
import { z } from "zod";
import { authorizeSession } from "../lib/bindings";
import { eveRequest } from "../lib/eve-server";
import { caller, sameOrigin } from "../lib/identity";

const message = z
	.object({ message: z.string().trim().min(1).max(16000) })
	.strict();
const respond = z
	.object({ inputResponses: z.array(inputResponseSchema).min(1).max(16) })
	.strict();
const cancel = z.object({ turnId: z.string().min(1).max(200) }).strict();
export async function gateway(request: Request, path: string[]) {
	const owner = await caller(request);
	if (!owner) return new Response(null, { status: 401 });
	if (!sameOrigin(request)) return new Response(null, { status: 403 });
	const [eve, v1, session, id, action] = path;
	if (
		eve !== "eve" ||
		v1 !== "v1" ||
		session !== "session" ||
		!id ||
		!/^[A-Za-z0-9_-]+$/.test(id) ||
		path.length > 5
	)
		return new Response(null, { status: 404 });
	// Default deny: no create, clear/reset/compact, callbacks, subagent routes,
	// alternate encodings or unknown future Eve endpoints escape this allowlist.
	if (
		!(request.method === "GET" && action === "stream") &&
		!(
			request.method === "POST" &&
			(action === undefined || action === "cancel")
		)
	)
		return new Response(null, { status: 404 });
	if (!(await authorizeSession(owner, id)))
		return new Response(null, { status: 404 });
	const url = new URL(request.url);
	const upstream = new URL(
		`/eve/v1/session/${id}${action ? `/${action}` : ""}`,
		"http://internal",
	);
	let body: string | undefined;
	if (request.method === "GET") {
		for (const [key, value] of url.searchParams) {
			if (
				!["startIndex", "follow", "includeTailIndex"].includes(key) ||
				!/^(?:\d+|true|false)$/.test(value)
			)
				return new Response(null, { status: 400 });
			upstream.searchParams.set(key, value);
		}
	} else {
		const parsed = (
			action === "cancel" ? cancel : z.union([message, respond])
		).safeParse(await request.json().catch(() => null));
		if (!parsed.success) return new Response(null, { status: 400 });
		body = JSON.stringify(parsed.data);
	}
	const result = await eveRequest(owner, upstream.pathname + upstream.search, {
		method: request.method,
		body,
		signal: request.signal,
		headers: body ? { "content-type": "application/json" } : {},
	});
	const headers = new Headers({ "cache-control": "no-store" });
	for (const key of [
		"content-type",
		"x-eve-session-id",
		"x-eve-stream-format",
		"x-eve-stream-version",
		"x-eve-stream-tail-index",
	]) {
		const value = result.headers.get(key);
		if (value) headers.set(key, value);
	}
	return new Response(result.body, { status: result.status, headers });
}
