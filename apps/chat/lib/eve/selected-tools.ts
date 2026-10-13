import type { UiToolName } from "@/lib/ai/types";

const canvasTools: UiToolName[] = [
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
];

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

  if (canvasTools.includes(selectedTool)) {
    return [...canvasTools, "readDocument"];
  }
  if (selectedTool.endsWith("Document")) {
    return [selectedTool, "readDocument"];
  }
  return [selectedTool];
};
