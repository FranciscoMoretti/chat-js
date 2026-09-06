import { Database } from "bun:sqlite";
import { initTRPC, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { z } from "zod";

// A bounded SQLite analogue of the proposed application tables, not Eve storage.
export function openStore(path: string, history: boolean) {
	const db = new Database(path, { strict: true });
	db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS binding (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, operation TEXT NOT NULL,
      message TEXT NOT NULL, session TEXT UNIQUE,
      state TEXT NOT NULL CHECK(state IN ('creating','bound','uncertain')),
      UNIQUE(owner,operation), CHECK ((state = 'bound') = (session IS NOT NULL))
    );`);
	if (history)
		db.exec(`CREATE TABLE IF NOT EXISTS saved (
    id TEXT PRIMARY KEY REFERENCES binding(id), title TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0
  );`);
	return db;
}
type Binding = {
	id: string;
	owner: string;
	operation: string;
	message: string;
	session: string | null;
	state: "creating" | "bound" | "uncertain";
};
type Saved = { id: string; title: string; revision: number };
const t = initTRPC.context<{ owner: string | null }>().create();
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.owner) throw new TRPCError({ code: "UNAUTHORIZED" });
	return next({ ctx: { owner: ctx.owner } });
});
const idInput = z.object({ id: z.uuid() }).strict();
const missing = () => new TRPCError({ code: "NOT_FOUND" });
const conflict = () => new TRPCError({ code: "CONFLICT" });

export function application(
	db: Database,
	createSession: (operation: string) => Promise<string>,
	history: boolean,
) {
	function owned(owner: string, id: string) {
		const row = db
			.query<Binding, [string, string]>(
				"SELECT * FROM binding WHERE owner = ? AND id = ?",
			)
			.get(owner, id);
		if (!row) throw missing();
		return row;
	}
	function resolve(owner: string, id: string) {
		const row = owned(owner, id);
		if (row.state !== "bound" || !row.session) throw conflict();
		return { id: row.id, session: row.session };
	}
	const conversation = t.router({
		create: protectedProcedure
			.input(
				z
					.object({
						operation: z.uuid(),
						message: z.string().trim().min(1).max(16000),
					})
					.strict(),
			)
			.mutation(async ({ ctx, input }) => {
				const id = crypto.randomUUID();
				const inserted = db
					.query<Binding, [string, string, string, string]>(
						"INSERT INTO binding VALUES (?,?,?,?,NULL,'creating') ON CONFLICT(owner,operation) DO NOTHING RETURNING *",
					)
					.get(id, ctx.owner, input.operation, input.message);
				if (!inserted) {
					const prior = db
						.query<Binding, [string, string]>(
							"SELECT * FROM binding WHERE owner = ? AND operation = ?",
						)
						.get(ctx.owner, input.operation);
					if (
						!prior ||
						prior.message !== input.message ||
						prior.state !== "bound"
					)
						throw conflict();
					return resolve(ctx.owner, prior.id);
				}
				try {
					const session = await createSession(id);
					db.query(
						"UPDATE binding SET session = ?, state = 'bound' WHERE id = ? AND owner = ?",
					).run(session, id, ctx.owner);
					return resolve(ctx.owner, id);
				} catch (error) {
					db.query(
						"UPDATE binding SET state = 'uncertain' WHERE id = ? AND state = 'creating'",
					).run(id);
					throw error;
				}
			}),
		resolve: protectedProcedure
			.input(idInput)
			.query(({ ctx, input }) => resolve(ctx.owner, input.id)),
	});
	const saved = t.router({
		save: protectedProcedure.input(idInput).mutation(({ ctx, input }) => {
			resolve(ctx.owner, input.id);
			db.query(
				"INSERT INTO saved(id,title) VALUES (?,'New conversation') ON CONFLICT(id) DO NOTHING",
			).run(input.id);
			return { id: input.id };
		}),
		list: protectedProcedure.query(({ ctx }) =>
			db
				.query<Saved, [string]>(
					"SELECT s.* FROM saved s JOIN binding b ON b.id = s.id WHERE b.owner = ? ORDER BY s.id",
				)
				.all(ctx.owner),
		),
		rename: protectedProcedure
			.input(
				idInput
					.extend({
						title: z.string().trim().min(1).max(255),
						revision: z.number().int().nonnegative(),
					})
					.strict(),
			)
			.mutation(({ ctx, input }) => {
				owned(ctx.owner, input.id);
				const row = db
					.query<Saved, [string, string, number, string]>(
						"UPDATE saved SET title = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM binding b WHERE b.id = saved.id AND b.owner = ?) RETURNING *",
					)
					.get(input.title, input.id, input.revision, ctx.owner);
				if (!row) throw conflict();
				return row;
			}),
		// Projection/metadata removal only. Deliberately NOT a product 'delete'.
		forget: protectedProcedure.input(idInput).mutation(({ ctx, input }) => {
			owned(ctx.owner, input.id);
			db.query(
				"DELETE FROM saved WHERE id = ? AND EXISTS (SELECT 1 FROM binding b WHERE b.id = saved.id AND b.owner = ?)",
			).run(input.id, ctx.owner);
			return { id: input.id };
		}),
	});
	const router = t.router({ conversation, ...(history ? { saved } : {}) });
	return {
		caller: (owner: string | null) => router.createCaller({ owner }),
		// Credential verification is injected by the fixture host, never by the body.
		request: (request: Request, verify: (request: Request) => string | null) =>
			fetchRequestHandler({
				endpoint: "/trpc",
				req: request,
				router,
				createContext: () => ({ owner: verify(request) }),
			}),
		authorizeSession: (owner: string, session: string) =>
			Boolean(
				db
					.query(
						"SELECT 1 FROM binding WHERE owner = ? AND session = ? AND state = 'bound'",
					)
					.get(owner, session),
			),
	};
}
