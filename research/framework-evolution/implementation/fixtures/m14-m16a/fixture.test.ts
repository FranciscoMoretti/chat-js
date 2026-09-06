import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { textResult } from "./contract";
import { documents } from "./documents.server";
import { attachments } from "./files.server";

test("committed tool result survives reopen, stale writes conflict, history stays exact, ACL precedes read/write", async () => {
	const dir = await mkdtemp(join(tmpdir(), "document-contract-"));
	const path = join(dir, "documents.db");
	let store = documents(path);
	try {
		const created = textResult.parse(
			JSON.parse(JSON.stringify(store.create("alice", "First", "one"))),
		);
		store.close();
		store = documents(path);
		expect(store.read("alice", created.ref)).toMatchObject({
			...created.ref,
			content: "one",
		});
		const edited = store.edit("alice", created.ref, "Second", "two");
		expect(store.read("alice", edited.ref)).toMatchObject({
			...edited.ref,
			baseRevisionId: created.ref.revisionId,
			content: "two",
		});
		expect(() =>
			store.edit("alice", created.ref, "Stale", "lost update"),
		).toThrow("CONFLICT");
		expect(store.read("alice", created.ref).content).toBe("one");
		expect(() => store.read("bob", created.ref)).toThrow("NOT_FOUND");
		expect(() => store.edit("bob", edited.ref, "Steal", "bad")).toThrow(
			"NOT_FOUND",
		);
		expect(() => store.create("", "Anonymous", "bad")).toThrow("UNAUTHORIZED");
		expect(store.read("alice", edited.ref).content).toBe("two");
		expect(
			textResult.safeParse({
				status: "success",
				documentId: created.ref.documentId,
				date: new Date().toISOString(),
			}).success,
		).toBe(false);
	} finally {
		store.close();
		await rm(dir, { recursive: true, force: true });
	}
});

test("real Files SDK fs bytes + durable ownership reject unauthorized upload/download", async () => {
	const dir = await mkdtemp(join(tmpdir(), "file-contract-"));
	let store = attachments(join(dir, "objects"), join(dir, "catalog.db"));
	try {
		await expect(store.upload("", new Blob(["bad"]))).rejects.toThrow(
			"UNAUTHORIZED",
		);
		const uploaded = await store.upload(
			"alice",
			new Blob(["hello"], { type: "text/plain" }),
		);
		store.close();
		store = attachments(join(dir, "objects"), join(dir, "catalog.db"));
		expect((await store.download("bob", uploaded.fileId)).status).toBe(404);
		expect((await store.download("", uploaded.fileId)).status).toBe(404);
		const response = await store.download("alice", uploaded.fileId);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("hello");
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	} finally {
		store.close();
		await rm(dir, { recursive: true, force: true });
	}
});

test("browser contract bundles without Files SDK, SQLite or provider code", async () => {
	const build = await Bun.build({
		entrypoints: [join(import.meta.dir, "contract.ts")],
		target: "browser",
	});
	expect(build.success).toBe(true);
	const code = await build.outputs[0]?.text();
	expect(code).toBeDefined();
	expect(code).not.toContain("bun:sqlite");
	expect(code).not.toContain("files-sdk");
});
