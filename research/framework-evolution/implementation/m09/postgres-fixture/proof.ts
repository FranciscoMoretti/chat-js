import assert from "node:assert/strict";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createTRPCClient, httpLink, TRPCClientError } from "@trpc/client";
import { SignJWT } from "jose";
import postgres from "postgres";
import { z } from "zod";
import type { AppRouter } from "./api";

const pgbin = process.env.PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
const root = mkdtempSync("/tmp/m09-pg-");
const data = join(root, "data"),
	ledger = join(root, "executions.jsonl");
writeFileSync(ledger, "", { mode: 0o600 });
const reservation = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	fetch: () => new Response(),
});
const pgPort = reservation.port;
assert(pgPort);
reservation.stop(true);
const pgUser = "m09_fixture",
	key = new TextEncoder().encode(crypto.randomUUID() + crypto.randomUUID());
const tasks: ReturnType<typeof Bun.spawn>[] = [];
const cases: { name: string; checks: number }[] = [],
	ports: number[] = [];
let checks = 0;
function check(value: unknown, message: string) {
	assert(value, message);
	checks++;
}
function equal(actual: unknown, expected: unknown) {
	assert.deepEqual(actual, expected);
	checks++;
}
async function errorCode(action: Promise<unknown>, code: string) {
	await assert.rejects(
		action,
		(error) => error instanceof TRPCClientError && error.data?.code === code,
	);
	checks++;
}
async function scenario(name: string, fn: () => Promise<void>) {
	const before = checks;
	await fn();
	cases.push({ name, checks: checks - before });
	console.log(`PASS ${name} (${checks - before} checks)`);
}
async function command(args: string[]) {
	const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
	const [out, err, status] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (status) throw new Error(`${args[0]} failed (${status}): ${out}\n${err}`);
	return out.trim();
}
async function startPg() {
	await command([
		join(pgbin, "pg_ctl"),
		"-D",
		data,
		"-l",
		join(root, "pg.log"),
		"-o",
		`-h '' -k ${root} -p ${pgPort}`,
		"-w",
		"start",
	]);
}
function sql(database: string) {
	return postgres({
		host: root,
		port: pgPort,
		username: pgUser,
		database,
		max: 1,
		onnotice: () => {},
	});
}
async function token(
	subject: string,
	issuer = "host-a",
	tenant = "tenant-a",
	expiry = "1h",
	audience = "m09-proof",
) {
	return new SignJWT({ tenant })
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(subject)
		.setIssuer(issuer)
		.setAudience(audience)
		.setExpirationTime(expiry)
		.sign(key);
}
async function startApi(database: string, history: boolean) {
	const ready = join(root, `ready-${crypto.randomUUID()}.json`);
	const child = Bun.spawn(
		[process.execPath, join(import.meta.dir, "server.ts")],
		{
			env: {
				...process.env,
				M09_PG_SOCKET: root,
				M09_PG_PORT: String(pgPort),
				M09_PG_DATABASE: database,
				M09_PG_USER: pgUser,
				M09_HOST_KEY: new TextDecoder().decode(key),
				M09_HISTORY: String(history),
				M09_EXECUTION_LEDGER: ledger,
				M09_READY: ready,
				M09_RELEASE: join(root, "release"),
			},
			stdout: "ignore",
			stderr: "pipe",
		},
	);
	tasks.push(child);
	for (let i = 0; i < 200 && !existsSync(ready); i++) {
		if (child.exitCode !== null)
			throw new Error(
				`API startup failed: ${await new Response(child.stderr).text()}`,
			);
		await Bun.sleep(25);
	}
	const info = z
		.object({ pid: z.number(), origin: z.url() })
		.parse(JSON.parse(readFileSync(ready, "utf8")));
	ports.push(Number(new URL(info.origin).port));
	return { ...info, child };
}
type Api = Awaited<ReturnType<typeof startApi>>;
function client(api: Api, credential?: string, origin = api.origin) {
	return createTRPCClient<AppRouter>({
		links: [
			httpLink({
				url: `${api.origin}/trpc`,
				headers: {
					...(credential ? { authorization: `Bearer ${credential}` } : {}),
					origin,
				},
			}),
		],
	});
}
function history(api: ReturnType<typeof client>) {
	if (!api.history) throw new Error("History not selected");
	return api.history;
}
function effects() {
	return readFileSync(ledger, "utf8").trim().split("\n").filter(Boolean).length;
}
async function kill(api: Api) {
	api.child.kill("SIGKILL");
	await api.child.exited;
}
let pgStarted = false;
try {
	const pgVersion = await command([join(pgbin, "pg_ctl"), "--version"]);
	await command([
		join(pgbin, "initdb"),
		"-D",
		data,
		"-U",
		pgUser,
		"-A",
		"trust",
		"--no-locale",
	]);
	await startPg();
	pgStarted = true;
	const admin = sql("postgres");
	await admin`CREATE DATABASE m09_minimal`;
	await admin`CREATE DATABASE m09_history`;
	await admin.end();
	const aliceToken = await token("alice"),
		bobToken = await token("bob");
	const minimal = await startApi("m09_minimal", false);
	const a0 = client(minimal, aliceToken),
		b0 = client(minimal, bobToken);
	let durable: { conversationId: string; sessionId: string } | undefined;
	await scenario(
		"host JWT with mandatory ACL and no history/auth tables",
		async () => {
			durable = await a0.conversation.create.mutate({
				operationId: crypto.randomUUID(),
				message: "hello",
			});
			equal(
				await a0.conversation.resolve.query({
					conversationId: durable.conversationId,
				}),
				durable,
			);
			equal(
				await a0.conversation.sessionBinding.query({
					sessionId: durable.sessionId,
				}),
				durable,
			);
			await errorCode(
				b0.conversation.resolve.query({
					conversationId: durable.conversationId,
				}),
				"NOT_FOUND",
			);
			await errorCode(
				b0.conversation.sessionBinding.query({ sessionId: durable.sessionId }),
				"NOT_FOUND",
			);
			await errorCode(history(a0).list.query({ limit: 30 }), "NOT_FOUND");
			const db = sql("m09_minimal");
			const tables = await db<
				{ table_name: string }[]
			>`SELECT table_schema || '.' || table_name AS table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')`;
			equal(
				tables.map((x) => x.table_name),
				["chatjs.conversations"],
			);
			await db.end();
		},
	);
	await scenario(
		"invalid credentials fail; issuer/tenant isolate; body owner and wrong origin rejected",
		async () => {
			assert(durable);
			const input = { conversationId: durable.conversationId };
			await errorCode(
				client(minimal).conversation.resolve.query(input),
				"UNAUTHORIZED",
			);
			await errorCode(
				client(
					minimal,
					await token("alice", "host-a", "tenant-a", "-1h"),
				).conversation.resolve.query(input),
				"UNAUTHORIZED",
			);
			await errorCode(
				client(
					minimal,
					await token("alice", "host-a", "tenant-a", "1h", "wrong"),
				).conversation.resolve.query(input),
				"UNAUTHORIZED",
			);
			await errorCode(
				client(
					minimal,
					`${aliceToken.slice(0, -8)}tampered`,
				).conversation.resolve.query(input),
				"UNAUTHORIZED",
			);
			await errorCode(
				client(
					minimal,
					await token("alice", "host-b"),
				).conversation.resolve.query(input),
				"NOT_FOUND",
			);
			await errorCode(
				client(
					minimal,
					await token("alice", "host-a", "tenant-b"),
				).conversation.resolve.query(input),
				"NOT_FOUND",
			);
			await errorCode(
				client(
					minimal,
					aliceToken,
					"https://wrong.example",
				).conversation.create.mutate({
					operationId: crypto.randomUUID(),
					message: "hello",
				}),
				"FORBIDDEN",
			);
			const response = await fetch(
				`${minimal.origin}/trpc/conversation.create`,
				{
					method: "POST",
					headers: {
						authorization: `Bearer ${aliceToken}`,
						origin: minimal.origin,
						"content-type": "application/json",
					},
					body: JSON.stringify({
						operationId: crypto.randomUUID(),
						message: "hello",
						owner_subject: "bob",
					}),
				},
			);
			equal(response.status, 400);
		},
	);
	let primary = await startApi("m09_history", true);
	const second = await startApi("m09_history", true);
	let alice = client(primary, aliceToken),
		bob = client(primary, bobToken);
	let savedRow: { conversationId: string; sessionId: string } | undefined;
	await scenario(
		"owner metadata CRUD and two-process CAS; foreign operations denied",
		async () => {
			savedRow = await alice.conversation.create.mutate({
				operationId: crypto.randomUUID(),
				message: "saved message",
			});
			const input = { conversationId: savedRow.conversationId };
			equal(await history(alice).list.query({ limit: 30 }), []);
			await history(alice).save.mutate(input);
			await history(alice).save.mutate(input);
			equal((await history(alice).list.query({ limit: 30 })).length, 1);
			equal(await history(bob).list.query({ limit: 30 }), []);
			await errorCode(bob.conversation.resolve.query(input), "NOT_FOUND");
			await errorCode(history(bob).save.mutate(input), "NOT_FOUND");
			await errorCode(
				history(bob).rename.mutate({
					...input,
					title: "stolen",
					expectedRevision: 0,
				}),
				"NOT_FOUND",
			);
			await errorCode(history(bob).forget.mutate(input), "NOT_FOUND");
			await errorCode(bob.conversation.revoke.mutate(input), "NOT_FOUND");
			const attempts = await Promise.allSettled([
				history(alice).rename.mutate({
					...input,
					title: "first winner",
					expectedRevision: 0,
				}),
				history(client(second, aliceToken)).rename.mutate({
					...input,
					title: "second winner",
					expectedRevision: 0,
				}),
			]);
			equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
			const rejected = attempts.find((x) => x.status === "rejected");
			check(
				rejected?.status === "rejected" &&
					rejected.reason instanceof TRPCClientError &&
					rejected.reason.data?.code === "CONFLICT",
				"CAS loser must conflict",
			);
			const listing = await history(alice).list.query({ limit: 30 });
			equal(listing[0]?.revision, 1);
			const text = JSON.stringify(listing);
			check(
				!text.includes("saved message") &&
					!text.includes("owner_subject") &&
					!text.includes(savedRow.sessionId),
				"List leaks no retry text, owner or session",
			);
			equal(await alice.conversation.resolve.query(input), savedRow);
		},
	);
	await scenario(
		"two processes share reservations without duplicate external effect",
		async () => {
			const input = {
					operationId: crypto.randomUUID(),
					message: "fixture:wait",
				},
				before = effects();
			const pending = alice.conversation.create.mutate(input);
			for (let i = 0; i < 200 && effects() === before; i++) await Bun.sleep(5);
			equal(effects(), before + 1);
			await errorCode(
				client(second, aliceToken).conversation.create.mutate(input),
				"CONFLICT",
			);
			writeFileSync(join(root, "release"), "ready");
			const row = await pending;
			equal(
				await client(second, aliceToken).conversation.create.mutate(input),
				row,
			);
			equal(effects(), before + 1);
			await errorCode(
				alice.conversation.create.mutate({ ...input, message: "changed" }),
				"CONFLICT",
			);
			const other = await bob.conversation.create.mutate(input);
			check(
				other.sessionId !== row.sessionId,
				"Owners must receive independent executions",
			);
			equal(effects(), before + 2);
		},
	);
	await scenario(
		"API SIGKILL and PostgreSQL crash recovery preserve ownership and metadata",
		async () => {
			assert(savedRow);
			assert(durable);
			const before = await history(alice).list.query({ limit: 30 });
			await kill(primary);
			await kill(second);
			await kill(minimal);
			await command([
				join(pgbin, "pg_ctl"),
				"-D",
				data,
				"-m",
				"immediate",
				"-w",
				"stop",
			]);
			pgStarted = false;
			await startPg();
			pgStarted = true;
			primary = await startApi("m09_history", true);
			alice = client(primary, aliceToken);
			bob = client(primary, bobToken);
			equal(await history(alice).list.query({ limit: 30 }), before);
			equal(
				await alice.conversation.resolve.query({
					conversationId: savedRow.conversationId,
				}),
				savedRow,
			);
			await errorCode(
				bob.conversation.resolve.query({
					conversationId: savedRow.conversationId,
				}),
				"NOT_FOUND",
			);
			const minimalRestart = await startApi("m09_minimal", false);
			equal(
				await client(minimalRestart, aliceToken).conversation.resolve.query({
					conversationId: durable.conversationId,
				}),
				durable,
			);
			check(
				readFileSync(join(root, "pg.log"), "utf8").includes(
					"database system was interrupted",
				),
				"Postgres must log crash recovery",
			);
		},
	);
	await scenario(
		"crash after external effect remains creating; ambiguous response remains uncertain; no duplicate on retry",
		async () => {
			const input = {
					operationId: crypto.randomUUID(),
					message: "fixture:crash-after-execution",
				},
				before = effects();
			await assert.rejects(alice.conversation.create.mutate(input));
			checks++;
			await primary.child.exited;
			equal(effects(), before + 1);
			primary = await startApi("m09_history", true);
			alice = client(primary, aliceToken);
			bob = client(primary, bobToken);
			equal(
				await alice.conversation.operation.query({
					operationId: input.operationId,
				}),
				{ state: "creating", operationId: input.operationId },
			);
			await errorCode(alice.conversation.create.mutate(input), "CONFLICT");
			equal(effects(), before + 1);
			equal(
				await bob.conversation.operation.query({
					operationId: input.operationId,
				}),
				{ state: "missing" },
			);
			const ambiguous = {
				operationId: crypto.randomUUID(),
				message: "fixture:ambiguous",
			};
			await errorCode(
				alice.conversation.create.mutate(ambiguous),
				"INTERNAL_SERVER_ERROR",
			);
			equal(
				await alice.conversation.operation.query({
					operationId: ambiguous.operationId,
				}),
				{ state: "uncertain", operationId: ambiguous.operationId },
			);
			await errorCode(alice.conversation.create.mutate(ambiguous), "CONFLICT");
			equal(effects(), before + 2);
		},
	);
	await scenario(
		"forget preserves ownership; explicit access revocation denies reads/writes while retaining tombstone",
		async () => {
			assert(savedRow);
			const input = { conversationId: savedRow.conversationId };
			await history(alice).forget.mutate(input);
			equal(await history(alice).list.query({ limit: 30 }), []);
			equal(await alice.conversation.resolve.query(input), savedRow);
			await history(alice).save.mutate(input);
			equal(await alice.conversation.revoke.mutate(input), {
				state: "access-revoked",
			});
			equal(await alice.conversation.revoke.mutate(input), {
				state: "access-revoked",
			});
			await errorCode(alice.conversation.resolve.query(input), "NOT_FOUND");
			await errorCode(
				alice.conversation.sessionBinding.query({
					sessionId: savedRow.sessionId,
				}),
				"NOT_FOUND",
			);
			await errorCode(history(alice).save.mutate(input), "NOT_FOUND");
			await errorCode(
				history(alice).rename.mutate({
					...input,
					title: "after delete",
					expectedRevision: 0,
				}),
				"NOT_FOUND",
			);
			equal(await history(alice).list.query({ limit: 30 }), []);
			const db = sql("m09_history");
			const [retained] = await db<
				{ session_id: string; deleted: boolean }[]
			>`SELECT session_id,deleted_at IS NOT NULL AS deleted FROM chatjs.conversations WHERE conversation_id=${savedRow.conversationId}`;
			equal(retained, { session_id: savedRow.sessionId, deleted: true });
			await db.end();
		},
	);
	const result = {
		date: new Date().toISOString(),
		bun: Bun.version,
		postgres: pgVersion,
		sourcePins: {
			m07: "688c7e944cb66397ec2a0e2a80f1557dc7325b07",
			pr318: "1b47cffe692acb8e2ebaf1ebebfa7ec76df75f10",
			pr317: "c686b31bb0fe00e3234eaa92af7f81ed4d172ad7",
		},
		checks,
		cases,
		apiPorts: ports,
		postgresPort: pgPort,
		postgresTransport: "unique temporary Unix socket; TCP disabled",
		limits: [
			"Controlled external execution; no Eve runtime/model call",
			"No OAuth/login UI, stream revocation, purge or generated installation",
			"List fixture is limited first page; keyset pagination remains planned",
			"Revocation and forget are separately tested options, not product deletion policy",
		],
	};
	writeFileSync(
		join(import.meta.dir, "evidence.json"),
		`${JSON.stringify(result, null, 2)}\n`,
	);
	console.log(`PASS ${cases.length} scenarios, ${checks} checks`);
} finally {
	for (const child of tasks) {
		if (child.exitCode === null) child.kill("SIGKILL");
		await child.exited;
	}
	if (pgStarted)
		await command([
			join(pgbin, "pg_ctl"),
			"-D",
			data,
			"-m",
			"immediate",
			"-w",
			"stop",
		]);
	rmSync(root, { recursive: true, force: true });
}
