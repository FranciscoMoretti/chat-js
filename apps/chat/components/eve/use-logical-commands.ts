"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { LogicalCommands } from "@/lib/eve/logical-commands";

export const useLogicalCommands = (
  commands: Readonly<Pick<LogicalCommands, "get" | "subscribe">>,
  branchId: string
) => {
  const getSnapshot = useCallback(
    () => commands.get(branchId),
    [commands, branchId]
  );
  return useSyncExternalStore(commands.subscribe, getSnapshot, getSnapshot);
};
