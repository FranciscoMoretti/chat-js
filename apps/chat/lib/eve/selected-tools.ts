import type { UiToolName } from "../ai/types";

const toolGroups: Partial<Record<UiToolName, UiToolName[]>> = {
  createTextDocument: [
    "createTextDocument",
    "createCodeDocument",
    "createSheetDocument",
    "editTextDocument",
    "editCodeDocument",
    "editSheetDocument",
  ],
};

/** Canvas editing needs Eve's read operation to obtain the current revision. */
export const selectedEveTools = (
  selectedTool: UiToolName | null
): string[] | null => {
  if (!selectedTool) {
    return null;
  }
  const names = toolGroups[selectedTool] ?? [selectedTool];
  return names.some((name) => name.endsWith("Document"))
    ? [...names, "readDocument"]
    : names;
};
