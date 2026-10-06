import type { UiToolName } from "@/lib/ai/types";

const canvasTools: UiToolName[] = [
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
];

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (selectedEveTools); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): selectedEveTools preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Canvas editing needs Eve's read operation to obtain the current revision.
 * @param {UiToolName | null} selectedTool User-selected tool, or null when no explicit tool restriction is requested.
 * @returns {string[] | null} Selected execution names; canvas tools share their editing family and document operations also include readDocument. Null preserves unrestricted selection.
 */
export const selectedEveTools = (
  selectedTool: UiToolName | null
): string[] | null => {
  if (!selectedTool) {
    return null;
  }
  // oxlint-disable-next-line no-ternary -- Keep names as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const names = canvasTools.includes(selectedTool)
    ? canvasTools
    : [selectedTool];

  if (names.some((name) => name.endsWith("Document"))) {
    return [...names, "readDocument"];
  }
  return names;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable unicorn/no-null */
