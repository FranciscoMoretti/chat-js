"use client";

import { usePathname } from "next/navigation";

import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";

export type {
  ChatRouteSource,
  ParsedChatIdFromPathname,
} from "@/providers/parse-chat-id-from-pathname";

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/no-named-export (#527): Preserve the named useCurrentChatRoute API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/explicit-function-return-type (#560): Keep useCurrentChatRoute's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep useCurrentChatRoute's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const useCurrentChatRoute = () => {
  const pathname = usePathname();

  return parseChatIdFromPathname(pathname);
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
