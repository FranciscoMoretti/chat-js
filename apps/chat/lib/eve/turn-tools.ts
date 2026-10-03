/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types"; "../types/anonymous" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
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

/* oxlint-disable import/group-exports, unicorn/no-null  --
 * import/group-exports (#523): eveTurnTool stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveTurnTool API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * unicorn/no-null (#570): eveTurnTool preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
// Set only by turn.started. Approval/reconnect authentication must not change it.
export const eveTurnTool = defineState<UiToolName | null>(
  "chatjs.turn-tool",
  () => null
);
/* oxlint-enable import/group-exports, unicorn/no-null */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveTurnGuest stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveTurnGuest API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveTurnGuest = defineState<boolean>(
  "chatjs.turn-guest",
  () => false
);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): eveToolAllowed stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveToolAllowed API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const eveToolAllowed = (name: string): boolean =>
  !eveTurnGuest.get() ||
  ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some((tool) => tool === name);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): eveInstalledToolEnabled stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveInstalledToolEnabled API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): eveInstalledToolEnabled uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-optional-chaining (#542): eveInstalledToolEnabled handles optional Object.entries(eveDocumentOperations).find( ([key]) => key === name )?.[1] without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): eveInstalledToolEnabled accepts [key]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const eveInstalledToolEnabled = (name: string): boolean => {
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
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, import/group-exports  --
 * id-length (#506): filterEveTools uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): filterEveTools stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named filterEveTools API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-rest-spread-properties (#543): filterEveTools copies or separates ...tools while preserving existing object ownership; mutating source objects is not equivalent.
 */
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
/* oxlint-enable id-length, import/group-exports */
