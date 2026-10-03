/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named { GET, POST } API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const { GET, POST } = toNextJsHandler(auth);
/* oxlint-enable import/no-named-export */
