import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { EveAgentStore } from "eve/client";
import postgres from "postgres";
import { applicationClient } from "../lib/application-client";
import { required } from "../lib/env";
import { noteOutput } from "../lib/note-contract";
import { projectReducer } from "../lib/projection";
import { tokenFor } from "./identity";

const origin = required("APP_ORIGIN");
const headers = {
	authorization: `Bearer ${await tokenFor("effect-alice")}`,
	origin,
};
const note = `CRASH_BOUNDARY_${crypto.randomUUID()}`;
const binding = await applicationClient(
	origin,
	headers,
).conversation.create.mutate({
	operationId: crypto.randomUUID(),
	message: `Call confirm_note with note exactly ${note}.`,
});
const store = new EveAgentStore({
	host: `${origin}/api/eve`,
	headers,
	initialSession: { sessionId: binding.sessionId, streamIndex: 0 },
	reducer: projectReducer,
});
await store.resume();
const pending = Object.values(store.snapshot.data.pending)[0];
assert(pending);
const sql = postgres(required("SIDE_EFFECT_DATABASE_URL"), { max: 1 });
const spawn = () =>
	Bun.spawn(["node", "--env-file=.env.local", ".host/sink.js"], {
		cwd: new URL("..", import.meta.url).pathname,
		env: {
			...process.env,
			PORT: new URL(required("SIDE_EFFECT_ORIGIN")).port,
			SIDE_EFFECT_HOLD_FIRST: "1",
		},
		stdout: "pipe",
		stderr: "pipe",
	});
let receiver = spawn();
try {
	await setTimeout(500);
	const result = store.send({
		inputResponses: [{ requestId: pending.requestId, optionId: "approve" }],
	});
	// Observe the durable receiver commit before killing only its own process.
	let committed: { key: string; note: string; attempts: number } | undefined;
	for (let i = 0; i < 120; i++) {
		[committed] =
			await sql`SELECT key,note,attempts FROM notes WHERE note=${note}`;
		if (committed) break;
		await setTimeout(250);
	}
	assert(committed, "Effect did not commit");
	assert.equal(committed.attempts, 1);
	receiver.kill("SIGKILL");
	await receiver.exited;
	receiver = spawn();
	await result;
	const rows =
		await sql`SELECT key,note,attempts FROM notes WHERE note=${note}`;
	assert.equal(rows.length, 1);
	assert(rows[0].attempts >= 2);
	assert.equal(rows[0].key, committed.key);
	const part = store.snapshot.data.messages
		.flatMap((m) => m.parts)
		.find(
			(p) =>
				p.type === "dynamic-tool" &&
				p.toolName === "confirm_note" &&
				p.state === "output-available",
		);
	assert(
		part && part.type === "dynamic-tool" && part.state === "output-available",
	);
	assert.deepEqual(noteOutput.parse(part.output), { note, confirmed: true });
	const conflict = await fetch(
		new URL("/notes", required("SIDE_EFFECT_ORIGIN")),
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${required("SIDE_EFFECT_SECRET")}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ key: committed.key, note: "different" }),
		},
	);
	assert.equal(conflict.status, 409);
	console.log(
		JSON.stringify({
			sessionId: binding.sessionId,
			receiverKilledAfterCommit: true,
			receiverRestarted: true,
			effectRows: rows.length,
			deliveryAttempts: rows[0].attempts,
			stableExecutionKey: true,
			typedToolResult: true,
			mismatchedPayloadStatus: conflict.status,
			limit: "Receiver restart; Eve worker remained alive",
		}),
	);
} finally {
	receiver.kill("SIGKILL");
	await receiver.exited;
	await sql.end();
}
