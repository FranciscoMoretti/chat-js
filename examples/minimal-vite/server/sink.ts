import { createServer } from "node:http";
import postgres from "postgres";
import { z } from "zod";
import { required } from "../lib/env";

const sql = postgres(required("SIDE_EFFECT_DATABASE_URL"), { max: 2 });
await sql`CREATE TABLE IF NOT EXISTS notes (key text PRIMARY KEY, note text NOT NULL, attempts integer NOT NULL DEFAULT 1)`;
const input = z
	.object({
		key: z.string().min(1).max(300),
		note: z.string().min(1).max(1000),
	})
	.strict();
const server = createServer(async (req, res) => {
	if (req.method !== "POST" || req.url !== "/notes") {
		res.writeHead(404).end();
		return;
	}
	if (
		req.headers.authorization !== `Bearer ${required("SIDE_EFFECT_SECRET")}`
	) {
		res.writeHead(401).end();
		return;
	}
	try {
		let body = "";
		for await (const chunk of req) {
			body += chunk;
			if (body.length > 8000) {
				res.writeHead(413).end();
				return;
			}
		}
		const { key, note } = input.parse(JSON.parse(body));
		// Atomic dedupe at the actual effect boundary, including payload comparison.
		const [row] =
			await sql`INSERT INTO notes(key,note) VALUES(${key},${note}) ON CONFLICT(key) DO UPDATE SET attempts=notes.attempts+1 WHERE notes.note=excluded.note RETURNING attempts`;
		if (!row) {
			res.writeHead(409).end();
			return;
		}
		if (
			process.env.SIDE_EFFECT_HOLD_FIRST === "1" &&
			note.startsWith("CRASH_BOUNDARY_") &&
			row.attempts === 1
		) {
			console.log(JSON.stringify({ committedBeforeResponse: true, key }));
			return; // Fault injection: proof kills only this receiver after durable commit.
		}
		res
			.writeHead(200, { "content-type": "application/json" })
			.end(JSON.stringify({ note, confirmed: true }));
	} catch {
		if (!res.headersSent) res.writeHead(400);
		res.end();
	}
});
server.listen(Number(process.env.PORT), "127.0.0.1", () =>
	console.log("Effect receiver ready"),
);
