import { defineState } from "eve/context";

import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";

import type { UiToolName } from "../ai/types";
import { ANONYMOUS_LIMITS } from "../types/anonymous";
import { eveDocumentOperations } from "./document-contracts";
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

export const eveToolAllowed = (name: string) =>
  !eveTurnGuest.get() ||
  ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some((tool) => tool === name);

export const eveInstalledToolEnabled = (name: string) => {
  const operation = Object.entries(eveDocumentOperations).find(
    ([key]) => key === name
  )?.[1];
  if (operation) {
    return installedDocumentKinds.has(operation.kind);
  }
  if (name === "readDocument") {
    return installedDocumentKinds.size > 0;
  }
  if (name === "runCodeDocument") {
    return (
      installedDocumentKinds.has("code") &&
      installedToolNames.has("runCodeDocument")
    );
  }
  return true;
};

export const filterEveTools = <T extends object>(tools: T): Partial<T> => {
  const selected = selectedEveTools(eveTurnTool.get());
  const available: Partial<T> = { ...tools };
  for (const name in available) {
    if (
      !eveInstalledToolEnabled(name) ||
      !eveToolAllowed(name) ||
      (selected && !selected.includes(name))
    ) {
      // oxlint-disable-next-line typescript/no-dynamic-delete -- Filter a copy while preserving each registry key's concrete definition type.
      delete available[name];
    }
  }
  return available;
};
