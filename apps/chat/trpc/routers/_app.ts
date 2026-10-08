import { installedRouters } from "@/features/installed-routers";
// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between @/features/installed-routers and @/trpc/init still needs a supported server equivalence check; preserve the existing order meanwhile.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing installedRouters own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
