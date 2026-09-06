import { Database } from "bun:sqlite";
import { type RevisionRef, revision, textResult } from "./contract";

// Disposable SQLite implementation of the proposed transaction, not a production adapter.
export function documents(path: string) {
	const db = new Database(path, { strict: true });
	db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, owner TEXT NOT NULL, head TEXT);
    CREATE TABLE IF NOT EXISTS revisions (revisionId TEXT PRIMARY KEY, documentId TEXT NOT NULL REFERENCES documents(id), baseRevisionId TEXT REFERENCES revisions(revisionId), title TEXT NOT NULL, content TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS immutable_revision BEFORE UPDATE ON revisions BEGIN SELECT RAISE(ABORT, 'immutable'); END;`);
	function authorize(owner: string, id: string) {
		const row = db
			.query<{ head: string | null }, [string, string]>(
				"SELECT head FROM documents WHERE id=? AND owner=?",
			)
			.get(id, owner);
		if (!row) throw new Error("NOT_FOUND");
		return row;
	}
	function read(owner: string, ref: RevisionRef) {
		authorize(owner, ref.documentId);
		const row = db
			.query("SELECT * FROM revisions WHERE documentId=? AND revisionId=?")
			.get(ref.documentId, ref.revisionId);
		if (!row) throw new Error("NOT_FOUND");
		return revision.parse(row);
	}
	function insert(
		documentId: string,
		baseRevisionId: string | null,
		title: string,
		content: string,
	) {
		const row = db
			.query("INSERT INTO revisions VALUES (?, ?, ?, ?, ?) RETURNING *")
			.get(crypto.randomUUID(), documentId, baseRevisionId, title, content);
		const saved = revision.parse(row);
		db.query("UPDATE documents SET head=? WHERE id=?").run(
			saved.revisionId,
			documentId,
		);
		return textResult.parse({
			status: "success",
			ref: saved,
			kind: "text",
			title: saved.title,
		});
	}
	return {
		read,
		create: db.transaction((owner: string, title: string, content: string) => {
			if (!owner) throw new Error("UNAUTHORIZED");
			const id = crypto.randomUUID();
			db.query("INSERT INTO documents VALUES (?, ?, NULL)").run(id, owner);
			return insert(id, null, title, content);
		}),
		edit: db.transaction(
			(owner: string, base: RevisionRef, title: string, content: string) => {
				const current = authorize(owner, base.documentId);
				read(owner, base);
				if (current.head !== base.revisionId) throw new Error("CONFLICT");
				return insert(base.documentId, base.revisionId, title, content);
			},
		),
		close: () => db.close(),
	};
}
