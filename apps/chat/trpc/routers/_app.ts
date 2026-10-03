/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { installedRouters } from "@/features/installed-routers";
import { createCallerFactory, createTRPCRouter } from "@/trpc/init";

import { creditsRouter } from "./credits.router";
import { eveRouter } from "./eve.router";
import { projectRouter } from "./project.router";
import { settingsRouter } from "./settings.router";
/* oxlint-enable sort-imports */

/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties --
 * import/group-exports (#523): appRouter stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named appRouter API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-rest-spread-properties (#543): appRouter copies or separates ...installedRouters while preserving existing object ownership; mutating source objects is not equivalent.
 */
/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */

export const appRouter = createTRPCRouter({
  credits: creditsRouter,
  eve: eveRouter,
  ...installedRouters,
  project: projectRouter,
  settings: settingsRouter,
});
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties */

/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named AppRouter API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
// Export the type definition for the API.
export type AppRouter = typeof appRouter;
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): createCaller stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named createCaller API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
/* oxlint-enable import/group-exports, import/no-named-export */
