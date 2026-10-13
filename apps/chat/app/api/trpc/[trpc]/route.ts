import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const handler = async (
  req: ReadonlyNativeSurface<Request>
): Promise<Response> =>
  await fetchRequestHandler({
    createContext: createTRPCContext,
    endpoint: "/api/trpc",
    req,
    router: appRouter,
  });

export { handler as GET, handler as POST };
