import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import postgres from "postgres";
import { createRouter } from "./api";
import { caller } from "./identity";
import { initialize } from "./schema";

function required(name: string) {
	const value = process.env[name];
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}
const sql = postgres({
	host: required("M09_PG_SOCKET"),
	port: Number(required("M09_PG_PORT")),
	database: required("M09_PG_DATABASE"),
	username: required("M09_PG_USER"),
	max: 5,
	onnotice: () => {},
});
const history = process.env.M09_HISTORY === "true";
await initialize(sql, history);
const key = new TextEncoder().encode(required("M09_HOST_KEY"));
const ledger = required("M09_EXECUTION_LEDGER");
const router = createRouter(sql, history, async (id, message) => {
	// Controlled external execution. Not Eve or an upstream idempotency proof.
	const session = crypto.randomUUID();
	appendFileSync(ledger, `${JSON.stringify({ id, session })}\n`, {
		mode: 0o600,
	});
	if (message === "fixture:crash-after-execution")
		process.kill(process.pid, "SIGKILL");
	if (message === "fixture:ambiguous")
		throw new Error("Controlled lost response");
	if (message === "fixture:wait") {
		const release = required("M09_RELEASE");
		const deadline = Date.now() + 10000;
		while (!existsSync(release)) {
			if (Date.now() > deadline) throw new Error("Fixture release timed out");
			await Bun.sleep(5);
		}
	}
	return session;
});
let origin = "";
const server = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	fetch: async (request) =>
		fetchRequestHandler({
			endpoint: "/trpc",
			req: request,
			router,
			createContext: async () => ({
				request,
				origin,
				owner: await caller(request, key),
			}),
		}),
});
origin = `http://127.0.0.1:${server.port}`;
writeFileSync(
	required("M09_READY"),
	JSON.stringify({ pid: process.pid, origin }),
	{ mode: 0o600 },
);
process.on("SIGTERM", async () => {
	server.stop(true);
	await sql.end();
	process.exit(0);
});
