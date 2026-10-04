import { installedRouters } from "@/features/installed-routers";
import { createCallerFactory, createTRPCRouter } from "@/trpc/init";

import { creditsRouter } from "./credits.router";
import { eveRouter } from "./eve.router";
import { projectRouter } from "./project.router";
import { settingsRouter } from "./settings.router";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */

const appRouter = createTRPCRouter({
  credits: creditsRouter,
  eve: eveRouter,
  ...installedRouters,
  project: projectRouter,
  settings: settingsRouter,
});

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
