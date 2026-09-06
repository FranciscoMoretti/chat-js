import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { caller } from "../../../../lib/identity";
import { appRouter } from "../../../../lib/router";
export const runtime = "nodejs";
async function handle(request: Request) {
	return fetchRequestHandler({
		endpoint: "/api/trpc",
		req: request,
		router: appRouter,
		createContext: async () => ({ request, owner: await caller(request) }),
		responseMeta: () => ({ headers: { "cache-control": "no-store" } }),
	});
}
export const GET = handle;
export const POST = handle;
