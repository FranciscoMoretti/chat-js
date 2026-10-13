"use client";

import { createContext, useContext } from "react";
import type { ContextType } from "react";

import type { LogicalChat, LogicalChatSnapshot } from "@/lib/eve/logical-chat";
import type { ReadonlyEveMessageInput } from "@/lib/eve/readonly-message-types";

export const EveLogicalContext = createContext<{
  ownerId: string;
  controller: LogicalChat;
  snapshot: LogicalChatSnapshot;
} | null>(null);

export const useLogicalChat = (): NonNullable<
  ContextType<typeof EveLogicalContext>
> => {
  const value = useContext(EveLogicalContext);
  if (!value) {
    throw new Error("The conversation needs a logical chat runtime.");
  }
  return value;
};

export interface OpenRequest {
  readonly id: string;
  readonly sessionId: string;
  readonly ownerId: string;
  readonly chatId?: string;
  readonly title?: string;
  readonly operation?: { readonly message: ReadonlyEveMessageInput };
}

export const EveRuntimeContext = createContext<
  ((runtime: OpenRequest, navigate?: boolean) => Promise<void>) | null
>(null);

export const useEveRuntime = (): NonNullable<
  ContextType<typeof EveRuntimeContext>
> => {
  const open = useContext(EveRuntimeContext);
  if (!open) {
    throw new Error("Eve creation requires its layout runtime provider");
  }
  return open;
};
