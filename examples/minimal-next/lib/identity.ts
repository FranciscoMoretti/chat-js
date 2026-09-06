import { jwtVerify } from "jose";
import { required } from "./env";

// Replace this adapter with the host application's verifier. Never trust a
// browser-supplied subject/header without verifying its credential.
export async function caller(request: Request): Promise<string | null> {
	const bearer = request.headers
		.get("authorization")
		?.match(/^Bearer (.+)$/)?.[1];
	const cookie = request.headers
		.get("cookie")
		?.split(";")
		.map((v) => v.trim())
		.find((v) => v.startsWith("chatjs_identity="))
		?.slice("chatjs_identity=".length);
	const token = bearer ?? cookie;
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(
			token,
			new TextEncoder().encode(required("APP_IDENTITY_SECRET")),
			{
				algorithms: ["HS256"],
				issuer: "chatjs-host",
				audience: "chatjs-minimal",
			},
		);
		return payload.sub && payload.exp ? payload.sub : null;
	} catch {
		return null;
	}
}

export function sameOrigin(request: Request): boolean {
	return (
		request.method === "GET" ||
		request.headers.get("origin") === required("APP_ORIGIN")
	);
}
