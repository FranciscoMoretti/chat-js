"use client";

/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { usePathname } from "next/navigation";

import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named export from "@/providers/parse-chat-id-from-pathname" API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type {
  ChatRouteSource,
  ParsedChatIdFromPathname,
} from "@/providers/parse-chat-id-from-pathname";
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/no-named-export (#527): Preserve the named useCurrentChatRoute API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/explicit-function-return-type (#560): Keep useCurrentChatRoute's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep useCurrentChatRoute's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const useCurrentChatRoute = () => {
  const pathname = usePathname();

  return parseChatIdFromPathname(pathname);
};
/* oxlint-enable import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
