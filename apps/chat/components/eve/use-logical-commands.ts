"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { LogicalCommands } from "@/lib/eve/logical-commands";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useLogicalCommands); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useLogicalCommands: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships */

export const useLogicalCommands = (
  commands: Readonly<Pick<LogicalCommands, "get" | "subscribe">>,
  conversationId: string
) => {
  const getSnapshot = useCallback(
    () => commands.get(conversationId),
    [commands, conversationId]
  );
  return useSyncExternalStore(commands.subscribe, getSnapshot, getSnapshot);
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
