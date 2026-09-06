import { initTRPC, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { tool } from "ai";
import { z } from "zod";
import { revisionRef } from "./contract";
import { documents } from "./documents.server";
import { attachments } from "./files.server";

const textInput = z.object({ title: z.string(), content: z.string() }).strict();
const editInput = textInput.extend({
	documentId: z.uuid(),
	baseRevisionId: z.uuid(),
});
const t = initTRPC.context<{ owner: string | null }>().create();
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.owner) throw new TRPCError({ code: "UNAUTHORIZED" });
	return next({ ctx: { owner: ctx.owner } });
});
function translate<T>(operation: () => T): T {
	try {
		return operation();
	} catch (error) {
		if (
			error instanceof Error &&
			(error.message === "NOT_FOUND" || error.message === "CONFLICT")
		) {
			throw new TRPCError({ code: error.message });
		}
		throw error;
	}
}
export function boundary(
	documentPath: string,
	fileRoot: string,
	catalogPath: string,
) {
	const store = documents(documentPath);
	const files = attachments(fileRoot, catalogPath);
	// Random opaque credentials are a fixture authenticator, not a second app auth system.
	const alice = crypto.randomUUID();
	const bob = crypto.randomUUID();
	const principals = new Map<string, string>([
		[alice, "alice"],
		[bob, "bob"],
	]);
	function owner(request: Request) {
		const bearer = request.headers
			.get("authorization")
			?.replace(/^Bearer /, "");
		const cookie = request.headers
			.get("cookie")
			?.split("; ")
			.find((value) => value.startsWith("fixture="))
			?.slice(8);
		return principals.get(bearer ?? cookie ?? "") ?? null;
	}
	function toolsFor(subject: string) {
		return {
			create: tool({
				inputSchema: textInput,
				execute: async ({ title, content }) =>
					store.create(subject, title, content),
			}),
			edit: tool({
				inputSchema: editInput,
				execute: async ({ documentId, baseRevisionId, title, content }) =>
					store.edit(
						subject,
						{ documentId, revisionId: baseRevisionId },
						title,
						content,
					),
			}),
		};
	}
	const router = t.router({
		getRevision: protectedProcedure
			.input(revisionRef)
			.query(({ ctx, input }) => translate(() => store.read(ctx.owner, input))),
		create: protectedProcedure
			.input(textInput)
			.mutation(({ ctx, input }) =>
				translate(() => store.create(ctx.owner, input.title, input.content)),
			),
		edit: protectedProcedure
			.input(editInput)
			.mutation(({ ctx, input }) =>
				translate(() =>
					store.edit(
						ctx.owner,
						{ documentId: input.documentId, revisionId: input.baseRevisionId },
						input.title,
						input.content,
					),
				),
			),
	});
	return {
		router,
		store,
		toolsFor,
		credentials: { alice, bob },
		async handle(request: Request): Promise<Response> {
			const url = new URL(request.url);
			const origin = request.headers.get("origin");
			if (request.method !== "GET" && origin && origin !== url.origin)
				return new Response("Forbidden origin", { status: 403 });
			if (url.pathname.startsWith("/trpc/"))
				return fetchRequestHandler({
					endpoint: "/trpc",
					req: request,
					router,
					createContext: () => ({ owner: owner(request) }),
				});
			if (url.pathname.startsWith("/files")) {
				const subject = owner(request);
				if (!subject) return new Response("Unauthorized", { status: 401 });
				if (url.pathname === "/files" && request.method === "POST") {
					const form = await request.formData();
					const upload = form.get("file");
					if (
						!(upload instanceof File) ||
						upload.size > 5 * 1024 * 1024 ||
						!["image/jpeg", "image/png", "application/pdf"].includes(
							upload.type,
						)
					)
						return new Response("Invalid upload", { status: 400 });
					return Response.json(await files.upload(subject, upload));
				}
				if (request.method === "GET")
					return files.download(subject, url.pathname.slice(7));
				return new Response("Method not allowed", { status: 405 });
			}
			return new Response("Not found", { status: 404 });
		},
		close() {
			store.close();
			files.close();
		},
	};
}
export type DocumentRouter = ReturnType<typeof boundary>["router"];
