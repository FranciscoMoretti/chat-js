import { determineExplicitlyRequestedTools } from "../ai/determine-explicitly-requested-tools";
import type { UiToolName } from "../ai/types";

/** Canvas editing needs Eve's read operation to obtain the current revision. */
export const selectedEveTools = (
  selectedTool: UiToolName | null
): string[] | null => {
  if (!selectedTool) {
    return null;
  }
  const names = determineExplicitlyRequestedTools(selectedTool) ?? [
    selectedTool,
  ];
  return names.some((name) => name.endsWith("Document"))
    ? [...names, "readDocument"]
    : names;
};
