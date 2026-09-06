import { createTRPCClient, httpLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./router";
export type Binding = inferRouterOutputs<AppRouter>["conversation"]["resolve"];
export function applicationClient(
	origin = "",
	headers: Record<string, string> = {},
) {
	return createTRPCClient<AppRouter>({
		links: [httpLink({ url: `${origin}/api/trpc`, headers })],
	});
}
