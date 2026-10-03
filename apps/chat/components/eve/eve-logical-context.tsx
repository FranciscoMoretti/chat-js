"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { createContext, useContext } from "react";

import type { LogicalChat, LogicalChatSnapshot } from "@/lib/eve/logical-chat";
import type { EveMessageInput } from "@/lib/eve/message-input";
/* oxlint-enable sort-imports */
/* oxlint-disable import/group-exports, import/no-named-export, unicorn/no-null -- EveLogicalContext: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveLogicalContext = createContext<{
  ownerId: string;
  controller: LogicalChat;
  snapshot: LogicalChatSnapshot;
} | null>(null);
/* oxlint-enable import/group-exports, import/no-named-export, unicorn/no-null */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useLogicalChat: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const useLogicalChat = () => {
  const value = useContext(EveLogicalContext);
  if (!value) {
    throw new Error("The conversation needs a logical chat runtime.");
  }
  return value;
};
/* oxlint-enable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/no-named-export -- OpenRequest: import/no-named-export: existing callers import this public component, type, or hook by name. */

export interface OpenRequest {
  id: string;
  sessionId: string;
  ownerId: string;
  chatId?: string;
  title?: string;
  operation?: { message: EveMessageInput };
}
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EveRuntimeContext: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including runtime: OpenRequest); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveRuntimeContext = createContext<
  ((runtime: OpenRequest, navigate?: boolean) => Promise<void>) | null
>(null);
/* oxlint-enable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useEveRuntime: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */
export const useEveRuntime = () => {
  const open = useContext(EveRuntimeContext);
  if (!open) {
    throw new Error("Eve creation requires its layout runtime provider");
  }
  return open;
};
/* oxlint-enable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
