import { installedRouters } from "@/features/installed-routers";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { createCallerFactory, createTRPCRouter } from "@/trpc/init";
/* oxlint-enable sort-imports */

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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (appRouter, createCaller); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { appRouter, createCaller };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (AppRouter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { AppRouter };
/* oxlint-enable import/no-named-export */
