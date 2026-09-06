import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Client, EveAgentStore } from "eve/client";
import { applicationClient } from "../lib/application-client";
import { required } from "../lib/env";
import { projectReducer } from "../lib/projection";
import { tokenFor } from "./identity";

const origin = required("APP_ORIGIN");
const owner = "proof-alice";
const alice = await tokenFor(owner);
const bob = await tokenFor("proof-bob");
const headers = {
	authorization: `Bearer ${alice}`,
	origin,
	"content-type": "application/json",
};
const client = new Client({
	host: `${origin}/api/eve`,
	headers,
	redirect: "error",
});
const statePath = new URL("../evidence/recovery.json", import.meta.url);
await mkdir(new URL("../evidence/", import.meta.url), { recursive: true });
if (process.argv[2] === "prepare") {
	const operationId = crypto.randomUUID();
	const result = await applicationClient(
		origin,
		headers,
	).conversation.create.mutate({
		operationId,
		message: "Please confirm a note: M07 recovery proof.",
	});
	const sessionId: string = result.sessionId;
	const conversationId: string = result.conversationId;
	const store = new EveAgentStore({
		session: client.sessions.attach(sessionId),
		reducer: projectReducer,
	});
	await store.resume();
	assert.equal(Object.keys(store.snapshot.data.pending).length, 1);
	const pending = Object.values(store.snapshot.data.pending)[0];
	assert(pending);
	const negative: Record<string, number> = {};
	async function denied(
		path: string,
		method: string,
		body?: unknown,
		raw = false,
		service = false,
	) {
		const base = raw ? required("EVE_INTERNAL_ORIGIN") : origin;
		const auth = service ? required("EVE_GATEWAY_SECRET") : bob;
		const response = await fetch(base + path, {
			method,
			headers: {
				authorization: `Bearer ${auth}`,
				origin,
				"content-type": "application/json",
				"x-chatjs-owner": "proof-bob",
			},
			body: body ? JSON.stringify(body) : undefined,
		});
		negative[
			`${raw ? "raw" : "app"}:${service ? "service" : "user"}:${method}:${path}`
		] = response.status;
		assert(
			[401, 403, 404, 405].includes(response.status),
			`Unexpected ${response.status} for ${path}`,
		);
		await response.body?.cancel();
	}
	await denied(
		`/api/trpc/conversation.resolve?input=${encodeURIComponent(JSON.stringify({ conversationId }))}`,
		"GET",
	);
	for (const [method, suffix, body] of [
		["GET", "/stream?startIndex=0&follow=false", undefined],
		["POST", "", { message: "intrusion" }],
		[
			"POST",
			"",
			{
				inputResponses: [{ requestId: pending.requestId, optionId: "approve" }],
			},
		],
		["POST", "/cancel", { turnId: "turn_0" }],
		["POST", "/clear", {}],
		["POST", "/compact", {}],
		["POST", "/reset", {}],
	] as const) {
		await denied(`/api/eve/eve/v1/session/${sessionId}${suffix}`, method, body);
		await denied(`/eve/v1/session/${sessionId}${suffix}`, method, body, true);
		await denied(
			`/eve/v1/session/${sessionId}${suffix}`,
			method,
			body,
			true,
			true,
		);
	}
	for (const path of [
		"/eve/v1/session",
		"/eve/v1/callback/fake",
		"/eve/v1/task-input/fake",
		"/eve/v1/activity/fake",
		"/eve/v1/connections/fake/callback/fake",
		"/.well-known/workflow/v1/webhook/fake",
	])
		await denied(path, "POST", {});
	await denied("/api/eve/eve/v1/session", "POST", { message: "bypass" });
	const noAuth = await fetch(`${origin}/api/trpc/conversation.create`, {
		method: "POST",
		headers: { origin, "content-type": "application/json" },
		body: JSON.stringify({
			operationId: crypto.randomUUID(),
			message: "anonymous",
		}),
	});
	assert.equal(noAuth.status, 401);
	const csrf = await fetch(`${origin}/api/trpc/conversation.create`, {
		method: "POST",
		headers: { ...headers, origin: "https://evil.invalid" },
		body: JSON.stringify({ operationId: crypto.randomUUID(), message: "csrf" }),
	});
	assert.equal(csrf.status, 403);
	const snapshot = await client.sessions.attach(sessionId).snapshot();
	await writeFile(
		statePath,
		JSON.stringify({
			sessionId,
			conversationId,
			eventIds: snapshot.events.map((event) => event.meta.id),
		}),
	);
	await writeFile(
		new URL("../evidence/authorization.json", import.meta.url),
		JSON.stringify({ negative, noAuth: 401, csrf: 403 }, null, 2),
	);
	console.log(
		JSON.stringify({
			sessionId,
			conversationId,
			pending: true,
			authorizationChecks: Object.keys(negative).length + 2,
		}),
	);
} else if (process.argv[2] === "resume") {
	const state = JSON.parse(await readFile(statePath, "utf8"));
	const session = client.sessions.attach(state.sessionId);
	const snapshot = await session.snapshot();
	assert.deepEqual(
		snapshot.events.map((event) => event.meta.id),
		state.eventIds,
	);
	const store = new EveAgentStore({
		host: `${origin}/api/eve`,
		headers,
		initialSession: snapshot.session,
		reducer: projectReducer,
		initialEvents: snapshot.events,
	});
	assert.equal(Object.keys(store.snapshot.data.pending).length, 1);
	const pending = Object.values(store.snapshot.data.pending)[0];
	assert(pending);
	await store.send({
		inputResponses: [{ requestId: pending.requestId, optionId: "approve" }],
	});
	assert.equal(Object.keys(store.snapshot.data.pending).length, 0);
	assert(
		store.snapshot.data.messages.some((message) =>
			message.confirmedNotes.some(
				(note) => note.note === pending.action.input.note,
			),
		),
	);
	await store.send({ message: "Reply exactly M07_CONTINUED." });
	assert(
		store.snapshot.data.messages.some((message) =>
			message.parts.some(
				(part) => part.type === "text" && part.text.includes("M07_CONTINUED"),
			),
		),
	);
	console.log(
		JSON.stringify({
			restartReplay: true,
			replayEvents: snapshot.events.length,
			pendingRecovered: true,
			typedToolResult: true,
			continuation: true,
		}),
	);
}

if (process.argv[2] === "cancel") {
	const state = JSON.parse(await readFile(statePath, "utf8"));
	const session = client.sessions.attach(state.sessionId);
	const snapshot = await session.snapshot();
	const store = new EveAgentStore({
		host: `${origin}/api/eve`,
		headers,
		initialSession: snapshot.session,
		initialEvents: snapshot.events,
		reducer: projectReducer,
	});
	let cancellation: ReturnType<typeof store.cancel> | undefined;
	store.setCallbacks({
		onEvent(event) {
			if (event.type === "turn.started") cancellation ??= store.cancel();
		},
	});
	await store.send({
		message: "Write a 300-word story about a mountain expedition.",
	});
	assert(cancellation);
	const cancelResult = await cancellation;
	assert.equal(cancelResult.status, "accepted");
	let replay = await client.sessions.attach(state.sessionId).snapshot();
	for (
		let attempt = 0;
		attempt < 20 &&
		!replay.events
			.slice(snapshot.events.length)
			.some((event) => event.type === "turn.cancelled");
		attempt++
	) {
		await new Promise((resolve) => setTimeout(resolve, 250));
		replay = await client.sessions.attach(state.sessionId).snapshot();
	}
	assert(
		replay.events
			.slice(snapshot.events.length)
			.some((event) => event.type === "turn.cancelled"),
	);
	console.log(
		JSON.stringify({
			cancelResult,
			durableCancellation: true,
			cooperativeBoundary: true,
		}),
	);
}
