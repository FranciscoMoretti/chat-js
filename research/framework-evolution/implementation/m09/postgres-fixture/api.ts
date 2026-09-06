import { initTRPC, TRPCError } from "@trpc/server";
import type postgres from "postgres";
import { z } from "zod";

const t = initTRPC
	.context<{ owner: string | null; request: Request; origin: string }>()
	.create();
const protectedProcedure = t.procedure.use(({ ctx, next, type }) => {
	if (!ctx.owner) throw new TRPCError({ code: "UNAUTHORIZED" });
	if (type === "mutation" && ctx.request.headers.get("origin") !== ctx.origin)
		throw new TRPCError({ code: "FORBIDDEN" });
	return next({ ctx: { ...ctx, owner: ctx.owner } });
});
const idInput = z.object({ conversationId: z.uuid() }).strict();
const bindingOutput = z.object({
	conversationId: z.uuid(),
	sessionId: z.string().min(1),
});
const summary = z.object({
	conversationId: z.uuid(),
	title: z.string(),
	isPinned: z.boolean(),
	activityAt: z.string(),
	revision: z.number().int(),
});
const notFound = () => new TRPCError({ code: "NOT_FOUND" });
const conflict = () => new TRPCError({ code: "CONFLICT" });
type Binding = {
	conversation_id: string;
	owner_subject: string;
	operation_id: string;
	message: string;
	session_id: string | null;
	state: "creating" | "bound" | "uncertain";
	deleted_at: Date | null;
};
type SummaryRow = {
	conversation_id: string;
	title: string;
	is_pinned: boolean;
	activity_at: Date;
	revision: number;
};
function summaryOutput(row: SummaryRow) {
	return summary.parse({
		conversationId: row.conversation_id,
		title: row.title,
		isPinned: row.is_pinned,
		activityAt: row.activity_at.toISOString(),
		revision: row.revision,
	});
}

export function createRouter(
	sql: postgres.Sql,
	history: boolean,
	execute: (id: string, message: string) => Promise<string>,
) {
	async function owned(owner: string, id: string) {
		const [row] = await sql<
			Binding[]
		>`SELECT * FROM chatjs.conversations WHERE conversation_id = ${id} AND owner_subject = ${owner} AND deleted_at IS NULL`;
		if (!row) throw notFound();
		return row;
	}
	async function resolve(owner: string, id: string) {
		const row = await owned(owner, id);
		if (row.state !== "bound" || !row.session_id) throw conflict();
		return bindingOutput.parse({
			conversationId: row.conversation_id,
			sessionId: row.session_id,
		});
	}
	const conversation = t.router({
		create: protectedProcedure
			.input(
				z
					.object({
						operationId: z.uuid(),
						message: z.string().trim().min(1).max(16000),
					})
					.strict(),
			)
			.output(bindingOutput)
			.mutation(async ({ ctx, input }) => {
				const id = crypto.randomUUID();
				const inserted = await sql<
					Binding[]
				>`INSERT INTO chatjs.conversations(conversation_id,owner_subject,operation_id,message) VALUES (${id},${ctx.owner},${input.operationId},${input.message}) ON CONFLICT(owner_subject,operation_id) DO NOTHING RETURNING *`;
				if (!inserted.length) {
					const [prior] = await sql<
						Binding[]
					>`SELECT * FROM chatjs.conversations WHERE owner_subject=${ctx.owner} AND operation_id=${input.operationId}`;
					if (!prior || prior.deleted_at) throw notFound();
					if (prior.message !== input.message || prior.state !== "bound")
						throw conflict();
					return resolve(ctx.owner, prior.conversation_id);
				}
				try {
					const session = await execute(id, input.message);
					await sql`UPDATE chatjs.conversations SET session_id=${session},state='bound' WHERE conversation_id=${id} AND owner_subject=${ctx.owner}`;
					return await resolve(ctx.owner, id);
				} catch (error) {
					await sql`UPDATE chatjs.conversations SET state='uncertain' WHERE conversation_id=${id} AND state='creating'`;
					throw error;
				}
			}),
		resolve: protectedProcedure
			.input(idInput)
			.output(bindingOutput)
			.query(({ ctx, input }) => resolve(ctx.owner, input.conversationId)),
		sessionBinding: protectedProcedure
			.input(z.object({ sessionId: z.string().min(1) }).strict())
			.output(bindingOutput)
			.query(async ({ ctx, input }) => {
				const [row] = await sql<
					Binding[]
				>`SELECT * FROM chatjs.conversations WHERE session_id=${input.sessionId} AND owner_subject=${ctx.owner} AND state='bound' AND deleted_at IS NULL`;
				if (!row) throw notFound();
				return bindingOutput.parse({
					conversationId: row.conversation_id,
					sessionId: row.session_id,
				});
			}),
		operation: protectedProcedure
			.input(z.object({ operationId: z.uuid() }).strict())
			.output(
				z.discriminatedUnion("state", [
					z.object({ state: z.literal("missing") }),
					z.object({ state: z.literal("creating"), operationId: z.uuid() }),
					z.object({ state: z.literal("uncertain"), operationId: z.uuid() }),
					z.object({
						state: z.literal("bound"),
						operationId: z.uuid(),
						...bindingOutput.shape,
					}),
				]),
			)
			.query(async ({ ctx, input }) => {
				const [row] = await sql<
					Binding[]
				>`SELECT * FROM chatjs.conversations WHERE owner_subject=${ctx.owner} AND operation_id=${input.operationId} AND deleted_at IS NULL`;
				if (!row) return { state: "missing" };
				if (row.state === "bound")
					return {
						state: "bound",
						operationId: input.operationId,
						...(await resolve(ctx.owner, row.conversation_id)),
					};
				return { state: row.state, operationId: input.operationId };
			}),
		// Proves access revocation option, NOT a claim of execution erasure/cancellation.
		revoke: protectedProcedure
			.input(idInput)
			.output(z.object({ state: z.literal("access-revoked") }))
			.mutation(async ({ ctx, input }) => {
				const rows =
					await sql`UPDATE chatjs.conversations SET deleted_at=coalesce(deleted_at,now()) WHERE conversation_id=${input.conversationId} AND owner_subject=${ctx.owner} RETURNING conversation_id`;
				if (!rows.length) throw notFound();
				return { state: "access-revoked" };
			}),
	});
	const saved = t.router({
		save: protectedProcedure
			.input(idInput)
			.output(summary)
			.mutation(async ({ ctx, input }) => {
				// One transaction + row lock: save cannot commit after concurrent revocation.
				return sql.begin(async (tx) => {
					const [binding] = await tx<
						Binding[]
					>`SELECT * FROM chatjs.conversations WHERE conversation_id=${input.conversationId} AND owner_subject=${ctx.owner} AND state='bound' AND deleted_at IS NULL FOR UPDATE`;
					if (!binding) throw notFound();
					const [row] = await tx<
						SummaryRow[]
					>`INSERT INTO chatjs.saved_conversations(conversation_id) VALUES(${input.conversationId}) ON CONFLICT(conversation_id) DO UPDATE SET conversation_id=EXCLUDED.conversation_id RETURNING *`;
					if (!row) throw new Error("No saved result");
					return summaryOutput(row);
				});
			}),
		list: protectedProcedure
			.input(
				z
					.object({ limit: z.number().int().min(1).max(100).default(30) })
					.strict(),
			)
			.output(z.array(summary))
			.query(async ({ ctx, input }) => {
				const rows = await sql<
					SummaryRow[]
				>`SELECT s.* FROM chatjs.saved_conversations s JOIN chatjs.conversations c USING(conversation_id) WHERE c.owner_subject=${ctx.owner} AND c.deleted_at IS NULL ORDER BY s.is_pinned DESC,s.activity_at DESC,s.conversation_id DESC LIMIT ${input.limit}`;
				return rows.map(summaryOutput);
			}),
		rename: protectedProcedure
			.input(
				idInput
					.extend({
						title: z.string().trim().min(1).max(255),
						expectedRevision: z.number().int().nonnegative(),
					})
					.strict(),
			)
			.output(summary)
			.mutation(async ({ ctx, input }) => {
				const [row] = await sql<
					SummaryRow[]
				>`UPDATE chatjs.saved_conversations s SET title=${input.title},revision=s.revision+1 FROM chatjs.conversations c WHERE s.conversation_id=${input.conversationId} AND c.conversation_id=s.conversation_id AND c.owner_subject=${ctx.owner} AND c.deleted_at IS NULL AND s.revision=${input.expectedRevision} RETURNING s.*`;
				if (!row) {
					await owned(ctx.owner, input.conversationId);
					throw conflict();
				}
				return summaryOutput(row);
			}),
		forget: protectedProcedure
			.input(idInput)
			.output(z.object({ removed: z.literal(true) }))
			.mutation(async ({ ctx, input }) => {
				await owned(ctx.owner, input.conversationId);
				await sql`DELETE FROM chatjs.saved_conversations s USING chatjs.conversations c WHERE s.conversation_id=${input.conversationId} AND c.conversation_id=s.conversation_id AND c.owner_subject=${ctx.owner} AND c.deleted_at IS NULL`;
				return { removed: true };
			}),
	});
	return t.router({ conversation, ...(history ? { history: saved } : {}) });
}
export type AppRouter = ReturnType<typeof createRouter>;
