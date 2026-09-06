import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { boundary } from "./api.server";

test("tool save failure rolls back creation; revision update and foreign-document base rejected", async () => {
	const root = await mkdtemp(join(tmpdir(), "revision-rollback-"));
	const path = join(root, "documents.db");
	const api = boundary(path, join(root, "bytes"), join(root, "catalog.db"));
	const inspector = new Database(path);
	try {
		inspector.exec(
			"CREATE TRIGGER reject_save BEFORE INSERT ON revisions BEGIN SELECT RAISE(ABORT, 'injected save failure'); END",
		);
		const create = api.toolsFor("alice").create;
		if (!create.execute) throw new Error("No tool execute");
		await expect(
			create.execute(
				{ title: "bad", content: "bad" },
				{ messages: [], toolCallId: "failed-create", context: {} },
			),
		).rejects.toThrow("injected save failure");
		expect(
			inspector.query("SELECT count(*) AS count FROM documents").get(),
		).toEqual({ count: 0 });
		inspector.exec("DROP TRIGGER reject_save");
		const a = api.store.create("alice", "A", "A");
		const b = api.store.create("alice", "B", "B");
		expect(() =>
			inspector
				.query("UPDATE revisions SET content='overwritten' WHERE revisionId=?")
				.run(a.ref.revisionId),
		).toThrow("immutable");
		expect(() =>
			api.store.edit(
				"alice",
				{ documentId: a.ref.documentId, revisionId: b.ref.revisionId },
				"bad",
				"bad",
			),
		).toThrow("NOT_FOUND");
		inspector.exec(
			"CREATE TRIGGER reject_save BEFORE INSERT ON revisions BEGIN SELECT RAISE(ABORT, 'injected save failure'); END",
		);
		expect(() => api.store.edit("alice", a.ref, "fail", "fail")).toThrow(
			"injected save failure",
		);
		inspector.exec("DROP TRIGGER reject_save");
		const successor = api.store.edit("alice", a.ref, "success", "success");
		expect(api.store.read("alice", successor.ref).baseRevisionId).toBe(
			a.ref.revisionId,
		);
		expect(api.store.read("alice", a.ref).content).toBe("A");
	} finally {
		inspector.close();
		api.close();
		await rm(root, { recursive: true, force: true });
	}
});
