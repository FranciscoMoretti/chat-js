import { routers } from "@/integrations/routers";
import {
  createCallerFactory,
  createTRPCRouter,
  mergeRouters,
} from "@/trpc/init";

import { eveRouter } from "./eve.router";

const coreRouter = createTRPCRouter({ eve: eveRouter });
for (const router of routers) {
  if (Object.hasOwn(router, "__proto__")) {
    throw new Error("Reserved plugin router key: __proto__");
  }
}
const appRouter = mergeRouters(coreRouter, ...routers);

// Export the type definition for the API.
type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
const createCaller = createCallerFactory(appRouter);
export { appRouter, createCaller };
export type { AppRouter };
