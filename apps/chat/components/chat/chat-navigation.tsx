"use client";

import { createContext, useContext } from "react";

/** Embed the application without replacing its links or navigation controls. */
export const ChatNavigationContext = createContext<{
  readonly pathname: string;
  readonly navigate: (href: string) => void;
} | null>(null);

export const useChatNavigation = () => useContext(ChatNavigationContext);
