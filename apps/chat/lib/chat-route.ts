"use client";

import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";

import { usePathname } from "next/navigation";

export type {
  ChatRouteSource,
  ParsedChatIdFromPathname,
} from "@/providers/parse-chat-id-from-pathname";

export const useCurrentChatRoute = (): ReturnType<
  typeof parseChatIdFromPathname
> => {
  const pathname = usePathname();

  return parseChatIdFromPathname(pathname);
};
