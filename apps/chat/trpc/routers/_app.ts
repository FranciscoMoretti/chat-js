import { createCallerFactory, createTRPCRouter } from "@/trpc/init";

import { creditsRouter } from "./credits.router";
import { eveRouter } from "./eve.router";
import { mcpRouter } from "./mcp.router";
import { projectRouter } from "./project.router";
import { settingsRouter } from "./settings.router";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */

export const appRouter = createTRPCRouter({
  credits: creditsRouter,
  eve: eveRouter,
  mcp: mcpRouter,
  project: projectRouter,
  settings: settingsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
