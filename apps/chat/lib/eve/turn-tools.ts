import { defineState } from "eve/context";

import type { UiToolName } from "@/lib/ai/types";
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/chatjs/generated/installed-tools";

import { eveDocumentOperations } from "./document-contracts";
import { selectedEveTools } from "./selected-tools";

// Set only by turn.started. Approval/reconnect authentication must not change it.
const eveTurnTool = defineState<UiToolName | null>(
  "chatjs.turn-tool",
  () => null
);

const eveTurnAccount = defineState<boolean>("chatjs.turn-account", () => false);

const eveInstalledToolEnabled = (name: string): boolean => {
  const operation = Object.entries(eveDocumentOperations).find(
    ([key]: readonly [string, ...unknown[]]) => key === name
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

const filterEveTools = <T extends object>(tools: T): Partial<T> => {
  const selected = selectedEveTools(eveTurnTool.get());
  const snapshot = { ...tools };
  const available: Partial<T> = {};
  for (const name of Reflect.ownKeys(snapshot)) {
    if (
      typeof name === "string" &&
      (!eveInstalledToolEnabled(name) ||
        !eveTurnAccount.get() ||
        (selected && !selected.includes(name)))
    ) {
      continue;
    }
    // Keep spread's data-property semantics for symbols and special names.
    const descriptor = Object.getOwnPropertyDescriptor(snapshot, name);
    if (descriptor) {
      Object.defineProperty(available, name, descriptor);
    }
  }
  return available;
};
export { eveInstalledToolEnabled, eveTurnAccount, eveTurnTool, filterEveTools };
