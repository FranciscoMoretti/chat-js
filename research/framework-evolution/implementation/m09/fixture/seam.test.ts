import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { application, openStore } from "./seam";

function fixture(history: boolean) {
	const dir = mkdtempSync(join(tmpdir(), "m09-"));
	const path = join(dir, "app.sqlite");
	let db = openStore(path, history);
	return {
		get db() {
			return db;
		},
		reopen() {
			db.close();
			db = openStore(path, history);
			return db;
		},
		close() {
			db.close();
			rmSync(dir, { recursive: true });
		},
	};
}
const create = async () => crypto.randomUUID();
function saved(caller: ReturnType<ReturnType<typeof application>["caller"]>) {
	if (!caller.saved) throw new Error("History not selected");
	return caller.saved;
}

test("history absent: durable ACL survives reopening without saved tables", async () => {
	const f = fixture(false);
	try {
		const app = application(f.db, create, false);
		const row = await app.caller("issuer:user:alice").conversation.create({
			operation: crypto.randomUUID(),
			message: "hello",
		});
		const fresh = application(f.reopen(), create, false);
		expect(
			await fresh
				.caller("issuer:user:alice")
				.conversation.resolve({ id: row.id }),
		).toEqual(row);
		expect(fresh.authorizeSession("issuer:user:alice", row.session)).toBe(true);
		expect(fresh.authorizeSession("issuer:user:bob", row.session)).toBe(false);
		await expect(
			fresh.caller("issuer:user:bob").conversation.resolve({ id: row.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(
			f.db.query("SELECT name FROM sqlite_master WHERE name = 'saved'").all(),
		).toHaveLength(0);
	} finally {
		f.close();
	}
});

test("optional metadata: owner save/list/reopen/rename; foreign mutations denied; forgetting preserves ACL", async () => {
	const f = fixture(true);
	try {
		const app = application(f.db, create, true);
		const alice = app.caller("alice"),
			bob = app.caller("bob");
		const row = await alice.conversation.create({
			operation: crypto.randomUUID(),
			message: "hello",
		});
		expect(await saved(alice).list()).toEqual([]);
		await saved(alice).save({ id: row.id });
		await saved(alice).save({ id: row.id });
		expect(await saved(bob).list()).toEqual([]);
		await expect(saved(bob).save({ id: row.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(
			saved(bob).rename({ id: row.id, title: "stolen", revision: 0 }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(saved(bob).forget({ id: row.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		expect(
			await saved(alice).rename({
				id: row.id,
				title: "Saved thought",
				revision: 0,
			}),
		).toMatchObject({ revision: 1 });
		await expect(
			saved(alice).rename({ id: row.id, title: "stale tab", revision: 0 }),
		).rejects.toMatchObject({ code: "CONFLICT" });
		const fresh = application(f.reopen(), create, true);
		expect(await saved(fresh.caller("alice")).list()).toEqual([
			{ id: row.id, title: "Saved thought", revision: 1 },
		]);
		await saved(fresh.caller("alice")).forget({ id: row.id });
		expect(await saved(fresh.caller("alice")).list()).toEqual([]);
		expect(
			await fresh.caller("alice").conversation.resolve({ id: row.id }),
		).toEqual(row);
		expect(fresh.authorizeSession("bob", row.session)).toBe(false);
	} finally {
		f.close();
	}
});

test("same-owner concurrent duplicate cannot launch twice; operation key is owner-scoped", async () => {
	const f = fixture(false);
	try {
		const gate = Promise.withResolvers<void>();
		const started = Promise.withResolvers<void>();
		let calls = 0;
		const app = application(
			f.db,
			async () => {
				calls++;
				started.resolve();
				await gate.promise;
				return crypto.randomUUID();
			},
			false,
		);
		const operation = crypto.randomUUID();
		const input = { operation, message: "hello" };
		const pending = app.caller("alice").conversation.create(input);
		await started.promise;
		await expect(
			app.caller("alice").conversation.create(input),
		).rejects.toMatchObject({ code: "CONFLICT" });
		gate.resolve();
		const row = await pending;
		expect(await app.caller("alice").conversation.create(input)).toEqual(row);
		expect(calls).toBe(1);
		await expect(
			app
				.caller("alice")
				.conversation.create({ ...input, message: "different" }),
		).rejects.toMatchObject({ code: "CONFLICT" });
		const other = await app.caller("bob").conversation.create(input);
		expect(other.session).not.toBe(row.session);
		expect(calls).toBe(2);
	} finally {
		f.close();
	}
});

test("ambiguous external create remains unresolved after DB reopen; no automatic duplicate", async () => {
	const f = fixture(true);
	try {
		let calls = 0;
		const input = { operation: crypto.randomUUID(), message: "hello" };
		const app = application(
			f.db,
			async () => {
				calls++;
				throw new Error("response lost");
			},
			true,
		);
		await expect(
			app.caller("alice").conversation.create(input),
		).rejects.toThrow();
		const fresh = application(
			f.reopen(),
			async () => {
				calls++;
				return "duplicate";
			},
			true,
		);
		await expect(
			fresh.caller("alice").conversation.create(input),
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(calls).toBe(1);
		expect(await saved(fresh.caller("alice")).list()).toEqual([]);
		expect(f.db.query("SELECT state, session FROM binding").get()).toEqual({
			state: "uncertain",
			session: null,
		});
	} finally {
		f.close();
	}
});

test("HTTP API rejects missing credentials and body-supplied owner; valid host identity succeeds", async () => {
	const f = fixture(false);
	try {
		const app = application(f.db, create, false);
		// These fixed credentials are a test host verifier, not a production auth recipe.
		const verify = (request: Request) =>
			request.headers.get("authorization") === "Bearer test-alice"
				? "alice"
				: null;
		const input = { operation: crypto.randomUUID(), message: "hello" };
		const send = (body: unknown, authenticated: boolean) =>
			app.request(
				new Request("http://fixture/trpc/conversation.create", {
					method: "POST",
					headers: {
						"content-type": "application/json",
						...(authenticated ? { authorization: "Bearer test-alice" } : {}),
					},
					body: JSON.stringify(body),
				}),
				verify,
			);
		expect((await send(input, false)).status).toBe(401);
		expect((await send({ ...input, owner: "bob" }, true)).status).toBe(400);
		expect((await send(input, true)).status).toBe(200);
	} finally {
		f.close();
	}
});
