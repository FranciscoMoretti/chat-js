import { documentDefinitions } from "@/integrations/documents/definitions";
import type { UiToolName } from "@/lib/ai/types";

/** Canvas editing needs Eve's read operation to obtain the current revision.
 * @param {UiToolName | null} selectedTool User-selected tool, or null when no explicit tool restriction is requested.
 * @returns {string[] | null} Selected execution names; canvas tools share their editing family and document operations also include readDocument. Null preserves unrestricted selection.
 */
export const selectedEveTools = (
  selectedTool: UiToolName | null
): string[] | null => {
  if (selectedTool === null || selectedTool === "") {
    return null;
  }

  if (documentDefinitions.operations.has(selectedTool)) {
    return [...documentDefinitions.operations.keys(), "readDocument"];
  }
  if (selectedTool.endsWith("Document")) {
    return [selectedTool, "readDocument"];
  }
  return [selectedTool];
};
