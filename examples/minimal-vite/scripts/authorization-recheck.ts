import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { required } from "../lib/env";
import { tokenFor } from "./identity";

const origin = required("APP_ORIGIN");
const state = JSON.parse(
	await readFile(new URL("../evidence/recovery.json", import.meta.url), "utf8"),
);
const headers = {
	authorization: `Bearer ${await tokenFor("proof-bob")}`,
	origin,
	"x-chatjs-owner": "proof-alice",
	"content-type": "application/json",
};
const checks: Record<string, number> = {};
for (const [method, path, body] of [
	[
		"GET",
		`/api/trpc/conversation.resolve?input=${encodeURIComponent(JSON.stringify({ conversationId: state.conversationId }))}`,
		undefined,
	],
	[
		"GET",
		`/api/eve/eve/v1/session/${state.sessionId}/stream?startIndex=0&follow=false`,
		undefined,
	],
	[
		"POST",
		`/api/eve/eve/v1/session/${state.sessionId}`,
		{ message: "spoofed owner" },
	],
	[
		"POST",
		`/api/eve/eve/v1/session/${state.sessionId}/cancel`,
		{ turnId: "turn_0" },
	],
] as const) {
	const response = await fetch(origin + path, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});
	assert.equal(response.status, 404);
	await response.body?.cancel();
	checks[`${method} ${path}`] = response.status;
}
console.log(
	JSON.stringify({
		persistedAclAfterRestart: true,
		bobSpoofedAliceHeaderDenied: true,
		checks,
	}),
);
