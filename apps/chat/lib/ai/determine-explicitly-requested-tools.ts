import type { ToolName } from "./types";

/**
 * Maps a selected tool (from UI) to the list of tool names that should be explicitly requested.
 * This is the single source of truth for explicit tool mapping.
 */

export const determineExplicitlyRequestedTools = (
  selectedTool: ToolName | null
): ToolName[] | null => {
  if (selectedTool === "deepResearch") {
    return ["deepResearch"];
  }
  if (selectedTool === "webSearch") {
    return ["webSearch"];
  }
  if (selectedTool === "generateImage") {
    return ["generateImage"];
  }
  if (selectedTool === "createTextDocument") {
    return [
      "createTextDocument",
      "createCodeDocument",
      "createSheetDocument",
      "editTextDocument",
      "editCodeDocument",
      "editSheetDocument",
    ];
  }
  return null;
};
