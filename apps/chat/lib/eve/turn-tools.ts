/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types"; "../types/anonymous" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineState } from "eve/context";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";
/* oxlint-enable sort-imports */

import type { UiToolName } from "../ai/types";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ANONYMOUS_LIMITS } from "../types/anonymous";
/* oxlint-enable sort-imports */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 1 from Object.entries(...).find(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of tools rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveInstalledToolEnabled, eveToolAllowed, eveTurnGuest, eveTurnTool, filterEveTools); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable id-length */
export {
  eveInstalledToolEnabled,
  eveToolAllowed,
  eveTurnGuest,
  eveTurnTool,
  filterEveTools,
};
/* oxlint-enable import/no-named-export */
