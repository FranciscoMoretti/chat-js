/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 */
import type { UiToolName } from "../ai/types";
/* oxlint-enable import/no-relative-parent-imports */

const canvasTools: UiToolName[] = [
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
];

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, unicorn/no-null  --
 * import/no-named-export (#527): Preserve the named selectedEveTools API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): selectedEveTools remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): selectedEveTools's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): selectedEveTools's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-ternary (#518): selectedEveTools derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, unicorn/no-null */
