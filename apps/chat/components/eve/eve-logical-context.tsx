"use client";

import { createContext, useContext } from "react";

import type { LogicalChat, LogicalChatSnapshot } from "@/lib/eve/logical-chat";
import type { EveMessageInput } from "@/lib/eve/message-input";

export const EveLogicalContext = createContext<{
  ownerId: string;
  controller: LogicalChat;
  snapshot: LogicalChatSnapshot;
} | null>(null);

export const useLogicalChat = () => {
  const value = useContext(EveLogicalContext);
  if (!value) {
    throw new Error("The conversation needs a logical chat runtime.");
  }
  return value;
};

export type OpenRequest = {
  id: string;
  sessionId: string;
  ownerId: string;
  chatId?: string;
  title?: string;
  operation?: { message: EveMessageInput };
};
export const EveRuntimeContext = createContext<
  ((runtime: OpenRequest, navigate?: boolean) => Promise<void>) | null
>(null);
export const useEveRuntime = () => {
  const open = useContext(EveRuntimeContext);
  if (!open) {
    throw new Error("Eve creation requires its layout runtime provider");
  }
  return open;
};
