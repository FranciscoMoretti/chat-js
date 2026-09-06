import { required } from "./env";
export async function eveRequest(
	owner: string,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const headers = new Headers(init.headers);
	// Do not forward browser credentials, callback tokens, or identity headers.
	headers.set("authorization", `Bearer ${required("EVE_GATEWAY_SECRET")}`);
	headers.set("x-chatjs-owner", owner);
	return fetch(new URL(path, required("EVE_INTERNAL_ORIGIN")), {
		...init,
		headers,
		redirect: "error",
		cache: "no-store",
	});
}
