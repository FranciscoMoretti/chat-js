import { defineState } from "eve/context";
import type { UiToolName } from "../ai/types";
import { ANONYMOUS_LIMITS } from "../types/anonymous";
import { selectedEveTools } from "./selected-tools";

// Set only by turn.started. Approval/reconnect authentication must not change it.
export const eveTurnTool = defineState<UiToolName | null>(
  "chatjs.turn-tool",
  () => null
);

export const eveTurnGuest = defineState<boolean>(
  "chatjs.turn-guest",
  () => false
);

export function eveToolAllowed(name: string) {
  return (
    !eveTurnGuest.get() ||
    ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some((tool) => tool === name)
  );
}

export function filterEveTools<T>(tools: Record<string, T>): Record<string, T> {
  const selected = selectedEveTools(eveTurnTool.get());
  return Object.fromEntries(
    Object.entries(tools).filter(
      ([name]) => eveToolAllowed(name) && (!selected || selected.includes(name))
    )
  );
}
