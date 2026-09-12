import { mock } from "bun:test";
import { strict as assert } from "node:assert";
import { drizzle } from "../../apps/chat/node_modules/drizzle-orm/postgres-js";
import postgres from "../../apps/chat/node_modules/postgres";
const socket = process.env.DOCUMENT_PROOF_SOCKET;
if (!socket?.startsWith("/tmp/chatjs-document-pg."))
	throw new Error(
		"DOCUMENT_PROOF_SOCKET must name an isolated PostgreSQL socket directory",
	);
const sql = postgres({ host: socket, database: "postgres", max: 2 });
mock.module("server-only", () => ({}));
mock.module("../../apps/chat/lib/env", () => ({
	env: { AUTH_SECRET: "disposable-test-only" },
}));
mock.module("../../apps/chat/lib/db/client", () => ({ db: drizzle(sql) }));
mock.module("../../apps/chat/lib/file-storage", () => ({
	deleteFilesByUrls: () => {
		throw new Error("Not in proof scope");
	},
}));
mock.module("../../apps/chat/lib/logger", () => ({
	createModuleLogger: () => ({}),
}));
mock.module("../../apps/chat/lib/message-conversion", () => ({
	chatMessageToDbMessage: () => {
		throw new Error("Not in proof scope");
	},
}));
mock.module("../../apps/chat/lib/utils/message-mapping", () => ({
	mapDBPartsToUIParts: () => {
		throw new Error("Not in proof scope");
	},
	mapUIMessagePartsToDBParts: () => {
		throw new Error("Not in proof scope");
	},
}));
const { saveDocument, updateDocument } = await import(
	"../../apps/chat/lib/db/queries"
);
try {
	await sql`DROP TABLE IF EXISTS "Document"`;
	await sql`DROP FUNCTION IF EXISTS reject_save()`;
	await sql`CREATE TABLE "Document" (id uuid NOT NULL, "createdAt" timestamp NOT NULL, title text NOT NULL, content text, kind varchar NOT NULL, "userId" text NOT NULL, "messageId" uuid NOT NULL, PRIMARY KEY(id,"createdAt"))`;
	const input = {
		id: crypto.randomUUID(),
		title: "T",
		content: "one",
		kind: "text",
		userId: "owner",
		messageId: crypto.randomUUID(),
	} satisfies Parameters<typeof saveDocument>[0];
	const saved = await saveDocument(input);
	const persisted =
		await sql`SELECT "createdAt" FROM "Document" WHERE id=${input.id}`;
	assert.equal(
		saved.createdAt.toISOString(),
		new Date(`${persisted[0]?.createdAt}Z`).toISOString(),
	);
	assert.equal(await updateDocument({ ...input, userId: "other" }), null);
	assert.equal(await updateDocument({ ...input, kind: "code" }), null);
	assert.equal(
		Number((await sql`SELECT count(*) AS n FROM "Document"`)[0]?.n),
		1,
	);
	await new Promise((resolve) => setTimeout(resolve, 5));
	const updated = await updateDocument({
		...input,
		content: "two",
		messageId: undefined,
	});
	assert.equal(updated?.messageId, input.messageId);
	assert.equal(updated?.content, "two");
	await sql`INSERT INTO "Document" VALUES (${input.id}, '2000-01-01', 'mixed', 'bad', 'text', 'other', ${input.messageId})`;
	assert.equal(await updateDocument(input), null);
	assert.equal(await updateDocument({ ...input, userId: "other" }), null);
	const count = Number((await sql`SELECT count(*) AS n FROM "Document"`)[0]?.n);
	await sql`CREATE FUNCTION reject_save() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'injected save failure'; END;$$`;
	await sql`CREATE TRIGGER reject_save BEFORE INSERT ON "Document" FOR EACH ROW EXECUTE FUNCTION reject_save()`;
	await assert.rejects(
		() => saveDocument({ ...input, id: crypto.randomUUID() }),
		(error: unknown) =>
			error instanceof Error &&
			error.cause instanceof Error &&
			error.cause.message === "injected save failure",
	);
	assert.equal(
		Number((await sql`SELECT count(*) AS n FROM "Document"`)[0]?.n),
		count,
	);
	console.log(
		"PostgreSQL actual-query proof: persisted identity, owner write, foreign/kind/mixed-owner denial, message retention and failure checks passed",
	);
} finally {
	await sql.end();
}
