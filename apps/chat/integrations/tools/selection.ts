import { installedSelectableToolNames } from "@/chatjs/generated/installed-tools";
import { toolDefinitions } from "./definitions";

// Display metadata does not itself grant selection or execution capabilities.
export const selectableToolNames: ReadonlySet<string> = new Set([
  ...installedSelectableToolNames,
  ...toolDefinitions
    .filter((definition) => definition.selectable === true)
    .map((definition) => definition.name),
]);
