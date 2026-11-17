import type { UiToolName } from "@/lib/ai/types";

export const selectedEveTools = (
  selectedTool: UiToolName | null
): string[] | null =>
  selectedTool === null || selectedTool === ""
    ? null
    : [
        selectedTool,
        ...(selectedTool === "deepResearch" ? ["attach_workspace_file"] : []),
      ];
