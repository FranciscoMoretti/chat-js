import { expect, test } from "bun:test";
import {
	authorizeSession,
	Conflict,
	createConversation,
	sql,
} from "../lib/bindings";

test("durable reservations isolate concurrent owners and block duplicate execution", async () => {
	const op = crypto.randomUUID();
	const owner = crypto.randomUUID();
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let started!: () => void;
	const ready = new Promise<void>((resolve) => {
		started = resolve;
	});
	let calls = 0;
	const first = createConversation(owner, op, "hello", async () => {
		calls++;
		started();
		await gate;
		return `session-${crypto.randomUUID()}`;
	});
	await ready;
	await expect(
		createConversation(owner, op, "hello", async () => {
			throw new Error("must not execute");
		}),
	).rejects.toBeInstanceOf(Conflict);
	const other = await createConversation(
		`${owner}-other`,
		op,
		"hello",
		async () => `other-${crypto.randomUUID()}`,
	);
	release();
	const bound = await first;
	expect(bound.session_id).not.toBe(other.session_id);
	expect(calls).toBe(1);
	if (!bound.session_id) throw new Error("Missing binding");
	expect(await authorizeSession(`${owner}-other`, bound.session_id)).toBe(
		false,
	);
	expect(await authorizeSession(owner, bound.session_id)).toBe(true);
	const retry = await createConversation(owner, op, "hello", async () => {
		throw new Error("must not execute");
	});
	expect(retry.session_id).toBe(bound.session_id);
	await expect(
		createConversation(owner, op, "changed", async () => ""),
	).rejects.toBeInstanceOf(Conflict);
});
test("ambiguous create stays fail-closed across retries", async () => {
	const owner = crypto.randomUUID();
	const op = crypto.randomUUID();
	await expect(
		createConversation(owner, op, "hello", async () => {
			throw new Error("lost response after execution");
		}),
	).rejects.toThrow();
	await expect(
		createConversation(owner, op, "hello", async () => "duplicate"),
	).rejects.toBeInstanceOf(Conflict);
	const [row] =
		await sql`SELECT state, session_id FROM chatjs.conversations WHERE owner_subject = ${owner} AND operation_id = ${op}`;
	expect(row?.state).toBe("uncertain");
	expect(row?.session_id).toBeNull();
});
