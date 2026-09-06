import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { Conflict, createConversation, sql } from "./bindings";
import { eveRequest } from "./eve-server";
import { sameOrigin } from "./identity";

const t = initTRPC
	.context<{ request: Request; owner: string | null }>()
	.create();
const protectedProcedure = t.procedure.use(({ ctx, next, type }) => {
	if (!ctx.owner)
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "The host application must supply a verified identity.",
		});
	if (type === "mutation" && !sameOrigin(ctx.request))
		throw new TRPCError({ code: "FORBIDDEN" });
	return next({ ctx: { ...ctx, owner: ctx.owner } });
});
const bindingSchema = z.object({
	conversationId: z.uuid(),
	sessionId: z.string().min(1),
});
export const appRouter = t.router({
	conversation: t.router({
		create: protectedProcedure
			.input(
				z
					.object({
						operationId: z.uuid(),
						message: z.string().trim().min(1).max(16000),
					})
					.strict(),
			)
			.output(bindingSchema)
			.mutation(async ({ ctx, input }) => {
				try {
					const binding = await createConversation(
						ctx.owner,
						input.operationId,
						input.message,
						async (operationId) => {
							const response = await eveRequest(ctx.owner, "/eve/v1/session", {
								method: "POST",
								headers: { "content-type": "application/json" },
								body: JSON.stringify({ message: input.message, operationId }),
							});
							if (!response.ok) throw new Error("Eve create failed");
							return z
								.object({ sessionId: z.string().min(1) })
								.parse(await response.json()).sessionId;
						},
					);
					return bindingSchema.parse({
						conversationId: binding.conversation_id,
						sessionId: binding.session_id,
					});
				} catch (error) {
					throw new TRPCError({
						code:
							error instanceof Conflict ? "CONFLICT" : "INTERNAL_SERVER_ERROR",
						message:
							error instanceof Conflict
								? error.message
								: "Creation unresolved; retain the operation ID for reconciliation",
					});
				}
			}),
		resolve: protectedProcedure
			.input(z.object({ conversationId: z.uuid() }).strict())
			.output(bindingSchema)
			.query(async ({ ctx, input }) => {
				const [binding] =
					await sql`SELECT conversation_id,session_id FROM chatjs.conversations WHERE conversation_id = ${input.conversationId} AND owner_subject = ${ctx.owner} AND state = 'bound'`;
				if (!binding) throw new TRPCError({ code: "NOT_FOUND" });
				return bindingSchema.parse({
					conversationId: binding.conversation_id,
					sessionId: binding.session_id,
				});
			}),
	}),
});
export type AppRouter = typeof appRouter;
