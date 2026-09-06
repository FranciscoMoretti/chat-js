import { Database } from "bun:sqlite";
import { createFiles } from "./storage.server";

// A concrete Files SDK integration. fs is only a local proof, not a serverless recipe.
export function attachments(root: string, catalog: string) {
	const files = createFiles(root);
	const db = new Database(catalog, { strict: true });
	db.exec(
		"CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, owner TEXT NOT NULL, key TEXT NOT NULL)",
	);
	return {
		async upload(owner: string, body: Blob) {
			if (!owner) throw new Error("UNAUTHORIZED");
			const id = crypto.randomUUID();
			const stored = await files.upload(id, body, { contentType: body.type });
			try {
				db.query("INSERT INTO files VALUES (?, ?, ?)").run(
					id,
					owner,
					stored.key,
				);
			} catch (error) {
				await files.delete(stored.key);
				throw error;
			}
			return { fileId: id, contentType: stored.contentType, size: stored.size };
		},
		// Caller is supplied by the host's verified context, never a request body.
		async download(owner: string, fileId: string) {
			const row = db
				.query<{ key: string }, [string, string]>(
					"SELECT key FROM files WHERE id=? AND owner=?",
				)
				.get(fileId, owner);
			if (!row) return new Response("Not found", { status: 404 });
			const stored = await files.download(row.key);
			return new Response(stored.stream(), {
				headers: {
					"Content-Type": stored.type,
					"Cache-Control": "private, no-store",
					"X-Content-Type-Options": "nosniff",
				},
			});
		},
		close: () => db.close(),
	};
}
