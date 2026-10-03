/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types"; "../types/anonymous" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineState } from "eve/context";

import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";

import type { UiToolName } from "../ai/types";
import { ANONYMOUS_LIMITS } from "../types/anonymous";
import { eveDocumentOperations } from "./document-contracts";
import { selectedEveTools } from "./selected-tools";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable unicorn/no-null -- unicorn/no-null (#570): eveTurnTool preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
// Set only by turn.started. Approval/reconnect authentication must not change it.
const eveTurnTool = defineState<UiToolName | null>(
  "chatjs.turn-tool",
  () => null
);
/* oxlint-enable unicorn/no-null */

const eveTurnGuest = defineState<boolean>("chatjs.turn-guest", () => false);

const eveToolAllowed = (name: string): boolean =>
  !eveTurnGuest.get() ||
  ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some((tool) => tool === name);

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- no-magic-numbers (#517): eveInstalledToolEnabled uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): eveInstalledToolEnabled accepts [key]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const eveInstalledToolEnabled = (name: string): boolean => {
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
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length -- id-length (#506): filterEveTools uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology. */
const filterEveTools = <T extends object>(tools: T): Partial<T> => {
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
/* oxlint-enable id-length */
export {
  eveInstalledToolEnabled,
  eveToolAllowed,
  eveTurnGuest,
  eveTurnTool,
  filterEveTools,
};
