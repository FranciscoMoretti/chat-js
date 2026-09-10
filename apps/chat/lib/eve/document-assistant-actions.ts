import { config } from "../config";

export type DocumentAssistantRequest = { message: string; modelId: string };

export function documentAssistantActions(kind: "text" | "code" | "sheet") {
  if (
    !(
      config.ai.tools.documents.enabled && config.ai.tools.documents.types[kind]
    )
  ) {
    return [];
  }
  switch (kind) {
    case "text":
      return [
        {
          label: "Add final polish",
          modelId: config.ai.tools.text.polish,
          instruction:
            "Add final polish, check grammar, add section titles for structure, and ensure the document reads smoothly.",
        },
      ];
    case "code":
      return [
        {
          label: "Add comments",
          modelId: config.ai.tools.code.edits,
          instruction: "Add comments to the code for understanding.",
        },
        {
          label: "Add logs",
          modelId: config.ai.tools.code.edits,
          instruction: "Add logs to the code for debugging.",
        },
      ];
    case "sheet":
      return [
        {
          label: "Format and clean data",
          modelId: config.ai.tools.sheet.format,
          instruction: "Format and clean the spreadsheet data.",
        },
        ...(config.ai.tools.documents.types.code
          ? [
              {
                label: "Analyze and visualize data",
                modelId: config.ai.tools.sheet.analyze,
                instruction:
                  "Analyze and visualize the spreadsheet data by creating a new Python code document.",
              },
            ]
          : []),
      ];
    default:
      return [];
  }
}

export function documentAssistantRequest(
  action: ReturnType<typeof documentAssistantActions>[number],
  documentId: string,
  revisionId: string
): DocumentAssistantRequest {
  return {
    modelId: action.modelId,
    message: `${action.instruction}\n\nTarget document: ${documentId}. Selected revision: ${revisionId}. Use readDocument to read this document, then use the document tools to apply the requested changes.`,
  };
}
