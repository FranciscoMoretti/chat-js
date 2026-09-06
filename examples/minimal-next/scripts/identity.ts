import { SignJWT } from "jose";
import { required } from "../lib/env";
export async function tokenFor(subject: string) {
	return new SignJWT({})
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer("chatjs-host")
		.setAudience("chatjs-minimal")
		.setSubject(subject)
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(new TextEncoder().encode(required("APP_IDENTITY_SECRET")));
}
