import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { caller } from "../lib/identity";
import { appRouter } from "../lib/router";
export async function trpc(request: Request) {
	return fetchRequestHandler({
		endpoint: "/api/trpc",
		req: request,
		router: appRouter,
		createContext: async () => ({ request, owner: await caller(request) }),
		responseMeta: () => ({ headers: { "cache-control": "no-store" } }),
	});
}
