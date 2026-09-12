"use client";

import { usePathname } from "next/navigation";

import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";

export type {
  ChatRouteSource,
  ParsedChatIdFromPathname,
} from "@/providers/parse-chat-id-from-pathname";

export const useCurrentChatRoute = () => {
  const pathname = usePathname();

  return parseChatIdFromPathname(pathname);
};
