import { defineState } from "eve/context";
import type { UiToolName } from "../ai/types";
import { selectedEveTools } from "./selected-tools";

// Set only by turn.started. Approval/reconnect authentication must not change it.
export const eveTurnTool = defineState<UiToolName | null>(
  "chatjs.turn-tool",
  () => null
);

export function filterEveTools<T>(tools: Record<string, T>): Record<string, T> {
  const selected = selectedEveTools(eveTurnTool.get());
  return selected
    ? Object.fromEntries(
        Object.entries(tools).filter(([name]) => selected.includes(name))
      )
    : tools;
}
