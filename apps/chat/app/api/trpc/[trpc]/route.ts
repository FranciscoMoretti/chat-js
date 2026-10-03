/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * typescript/prefer-readonly-parameter-types (#565): handler accepts req: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): handler preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
const handler = (req: Request): Promise<Response> =>
  fetchRequestHandler({
    createContext: createTRPCContext,
    endpoint: "/api/trpc",
    req,
    router: appRouter,
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named export from { handler as GET, handler as POST } API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export { handler as GET, handler as POST };
/* oxlint-enable import/no-named-export */
