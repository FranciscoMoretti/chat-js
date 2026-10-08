"use client";

import { createContext, useContext } from "react";
import type { ContextType } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { LogicalChat, LogicalChatSnapshot } from "@/lib/eve/logical-chat";
/* oxlint-enable sort-imports */
import type { EveMessageInput } from "@/lib/eve/message-input";
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveLogicalContext); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable unicorn/no-null -- unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

// oxlint-disable-next-line import/group-exports -- #711: Keep EveLogicalContext inline: Oxlint 1.82 classifies a grouped context specifier as a component and rejects the hooks; one-var rejects combining declarations.
export const EveLogicalContext = createContext<{
  ownerId: string;
  controller: LogicalChat;
  snapshot: LogicalChatSnapshot;
} | null>(null);
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (useLogicalChat); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable unicorn/no-null */

// oxlint-disable-next-line import/group-exports -- #711: Keep useLogicalChat inline with its context: grouped hooks violate exports-last beside inline contexts; placing them first violates no-use-before-define. Grouping every value instead triggers Oxlint 1.82 Fast Refresh classification.
export const useLogicalChat = (): NonNullable<
  ContextType<typeof EveLogicalContext>
> => {
  const value = useContext(EveLogicalContext);
  if (!value) {
    throw new Error("The conversation needs a logical chat runtime.");
  }
  return value;
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (OpenRequest); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

export interface OpenRequest {
  id: string;
  sessionId: string;
  ownerId: string;
  chatId?: string;
  title?: string;
  operation?: { message: EveMessageInput };
}
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveRuntimeContext); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null -- typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including runtime: OpenRequest); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

// oxlint-disable-next-line import/group-exports -- #711: Keep EveRuntimeContext inline: Oxlint 1.82 classifies a grouped context specifier as a component and rejects the hooks; one-var rejects combining declarations.
export const EveRuntimeContext = createContext<
  ((runtime: OpenRequest, navigate?: boolean) => Promise<void>) | null
>(null);
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (useEveRuntime); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */

// oxlint-disable-next-line import/group-exports -- #711: Keep useEveRuntime inline with its context: grouped hooks violate exports-last beside inline contexts; placing them first violates no-use-before-define. Grouping every value instead triggers Oxlint 1.82 Fast Refresh classification.
export const useEveRuntime = (): NonNullable<
  ContextType<typeof EveRuntimeContext>
> => {
  const open = useContext(EveRuntimeContext);
  if (!open) {
    throw new Error("Eve creation requires its layout runtime provider");
  }
  return open;
};
/* oxlint-enable import/no-named-export */
