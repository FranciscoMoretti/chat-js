import { jwtVerify } from "jose";

// The app supplies this verifier. No login endpoint, account table or auth SDK.
// Compared with M07: support multiple allowlisted issuers and typed tenant keys.
export async function caller(
	request: Request,
	key: Uint8Array,
): Promise<string | null> {
	const token = request.headers
		.get("authorization")
		?.match(/^Bearer (.+)$/)?.[1];
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, key, {
			algorithms: ["HS256"],
			issuer: ["host-a", "host-b"],
			audience: "m09-proof",
		});
		if (!payload.sub || !payload.exp || typeof payload.tenant !== "string")
			return null;
		return JSON.stringify([payload.iss, payload.tenant, "user", payload.sub]);
	} catch {
		return null;
	}
}
