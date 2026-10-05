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
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, unicorn/no-null --
 * jsdoc/require-param (#534): selectedEveTools's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): selectedEveTools's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * unicorn/no-null (#570): selectedEveTools preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Canvas editing needs Eve's read operation to obtain the current revision. */
export const selectedEveTools = (
  selectedTool: UiToolName | null
): string[] | null => {
  if (!selectedTool) {
    return null;
  }
  const names = canvasTools.includes(selectedTool)
    ? canvasTools
    : [selectedTool];
  return names.some((name) => name.endsWith("Document"))
    ? [...names, "readDocument"]
    : names;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, unicorn/no-null */
