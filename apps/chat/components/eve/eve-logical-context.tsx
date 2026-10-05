"use client";

import { createContext, useContext } from "react";
import type { ContextType } from "react";

import type { LogicalChat, LogicalChatSnapshot } from "@/lib/eve/logical-chat";
import type { EveMessageInput } from "@/lib/eve/message-input";
/* oxlint-disable import/group-exports, unicorn/no-null -- EveLogicalContext: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types.; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveLogicalContext = createContext<{
  ownerId: string;
  controller: LogicalChat;
  snapshot: LogicalChatSnapshot;
} | null>(null);
/* oxlint-enable import/group-exports, unicorn/no-null */

/* oxlint-disable import/group-exports -- useLogicalChat: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types. */

export const useLogicalChat = (): NonNullable<
  ContextType<typeof EveLogicalContext>
> => {
  const value = useContext(EveLogicalContext);
  if (!value) {
    throw new Error("The conversation needs a logical chat runtime.");
  }
  return value;
};
/* oxlint-enable import/group-exports */

export interface OpenRequest {
  id: string;
  sessionId: string;
  ownerId: string;
  chatId?: string;
  title?: string;
  operation?: { message: EveMessageInput };
}
/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EveRuntimeContext: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types.; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including runtime: OpenRequest); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveRuntimeContext = createContext<
  ((runtime: OpenRequest, navigate?: boolean) => Promise<void>) | null
>(null);
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable import/group-exports -- useEveRuntime: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types. */
export const useEveRuntime = (): NonNullable<
  ContextType<typeof EveRuntimeContext>
> => {
  const open = useContext(EveRuntimeContext);
  if (!open) {
    throw new Error("Eve creation requires its layout runtime provider");
  }
  return open;
};
/* oxlint-enable import/group-exports */
