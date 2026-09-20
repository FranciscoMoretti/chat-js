"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { LogicalCommands } from "@/lib/eve/logical-commands";

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
