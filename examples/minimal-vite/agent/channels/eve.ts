import { timingSafeEqual } from "node:crypto";
import { eveChannel } from "eve/channels/eve";
import { authorizeSession } from "../../lib/bindings";
import { required } from "../../lib/env";
export default eveChannel({
	auth: async (request) => {
		const expected = Buffer.from(`Bearer ${required("EVE_GATEWAY_SECRET")}`);
		const actual = Buffer.from(request.headers.get("authorization") ?? "");
		if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
			return null;
		const owner = request.headers.get("x-chatjs-owner");
		if (!owner) return null;
		const path = new URL(request.url).pathname;
		if (path !== "/eve/v1/session") {
			const match =
				/^\/eve\/v1\/session\/([A-Za-z0-9_-]+)(?:\/(stream|cancel))?$/.exec(
					path,
				);
			if (!match?.[1] || !(await authorizeSession(owner, match[1])))
				return null;
		}
		return {
			attributes: {},
			authenticator: "chatjs-gateway",
			issuer: "chatjs-host",
			principalType: "user",
			principalId: owner,
			subject: owner,
		};
	},
});
