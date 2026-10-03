"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { LogicalCommands } from "@/lib/eve/logical-commands";
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- useLogicalCommands: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including commands: LogicalCommands). */

export const useLogicalCommands = (
  commands: LogicalCommands,
  conversationId: string
) => {
  const getSnapshot = useCallback(
    () => commands.get(conversationId),
    [commands, conversationId]
  );
  return useSyncExternalStore(commands.subscribe, getSnapshot, getSnapshot);
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
