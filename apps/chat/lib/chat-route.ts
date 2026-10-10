"use client";

import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";

import { usePathname } from "next/navigation";
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ChatRouteSource, ParsedChatIdFromPathname); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

export type {
  ChatRouteSource,
  ParsedChatIdFromPathname,
} from "@/providers/parse-chat-id-from-pathname";
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (useCurrentChatRoute); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const useCurrentChatRoute = (): ReturnType<
  typeof parseChatIdFromPathname
> => {
  const pathname = usePathname();

  return parseChatIdFromPathname(pathname);
};
/* oxlint-enable import/no-named-export */
