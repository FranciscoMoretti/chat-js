import assert from "node:assert/strict";
import { EveAgentStore } from "eve/client";
import { applicationClient } from "../lib/application-client";
import { required } from "../lib/env";
import { projectReducer } from "../lib/projection";
import { tokenFor } from "./identity";

const origin = required("APP_ORIGIN");
const headers = {
	authorization: `Bearer ${await tokenFor("stream-alice")}`,
	origin,
};
const state = await applicationClient(
	origin,
	headers,
).conversation.create.mutate({
	operationId: crypto.randomUUID(),
	message: "Reply READY.",
});
const store = new EveAgentStore({
	host: `${origin}/api/eve`,
	headers,
	initialSession: { sessionId: state.sessionId, streamIndex: 0 },
	reducer: projectReducer,
});
await store.resume();
const counts: Record<string, number> = {};
let firstEvent: number | undefined;
let firstMessage: number | undefined;
const start = Date.now();
store.setCallbacks({
	onEvent(event) {
		firstEvent ??= Date.now();
		if (event.type === "message.appended") firstMessage ??= Date.now();
		counts[event.type] = (counts[event.type] ?? 0) + 1;
	},
});
await store.send({
	message:
		"Write an 80-word explanation of how rivers flow. Do not call tools.",
});
assert((counts["message.appended"] ?? 0) > 1, JSON.stringify(counts));
assert(counts["turn.completed"]);
console.log(
	JSON.stringify({
		incrementalMessageAppends: counts["message.appended"],
		firstEventMs: (firstEvent ?? start) - start,
		firstMessageMs: (firstMessage ?? start) - start,
		totalMs: Date.now() - start,
		counts,
	}),
);
