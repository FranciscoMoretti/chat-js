"use client";

import { useParams } from "next/navigation";
import { createContext, useContext } from "react";

/** Embed the application without replacing its links or navigation controls. */
export const ChatNavigationContext = createContext<{
  readonly chatId: string | null;
  readonly navigate: (href: string) => void;
} | null>(null);

export const useChatNavigation = () => useContext(ChatNavigationContext);

export const useActiveChatId = (): string | null => {
  const embedded = useChatNavigation();
  const params = useParams();
  if (embedded) {
    return embedded.chatId;
  }
  return typeof params?.chatId === "string" ? params.chatId : null;
};
