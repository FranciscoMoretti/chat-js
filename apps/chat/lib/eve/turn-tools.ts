import { defineState } from "eve/context";

import type { UiToolName } from "../ai/types";
import { config } from "../config";
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

export const eveToolAllowed = (name: string) =>
  !eveTurnGuest.get() ||
  ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some((tool) => tool === name);

export const eveInstalledToolEnabled = (name: string) =>
  (name !== "generateVideo" || config.ai.tools.video.enabled) &&
  (name !== "generateImage" || config.ai.tools.image.enabled) &&
  (name !== "webSearch" || config.ai.tools.webSearch.enabled) &&
  (name !== "retrieveUrl" || config.ai.tools.urlRetrieval.enabled) &&
  (name !== "codeExecution" || config.ai.tools.codeExecution.enabled);

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
