import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

import { config } from "../config";
import type { DocumentAssistantRequest } from "./document-contracts";

export const documentAssistantActions = (kind: "text" | "code" | "sheet") => {
  if (!installedDocumentKinds.has(kind)) {
    return [];
  }
  switch (kind) {
    case "text": {
      return [
        {
          instruction:
            "Add final polish, check grammar, add section titles for structure, and ensure the document reads smoothly.",
          label: "Add final polish",
          modelId: config.ai.tools.text.polish,
        },
      ];
    }
    case "code": {
      return [
        {
          instruction: "Add comments to the code for understanding.",
          label: "Add comments",
          modelId: config.ai.tools.code.edits,
        },
        {
          instruction: "Add logs to the code for debugging.",
          label: "Add logs",
          modelId: config.ai.tools.code.edits,
        },
      ];
    }
    case "sheet": {
      return [
        {
          instruction: "Format and clean the spreadsheet data.",
          label: "Format and clean data",
          modelId: config.ai.tools.sheet.format,
        },
        ...(installedDocumentKinds.has("code")
          ? [
              {
                instruction:
                  "Analyze and visualize the spreadsheet data by creating a new Python code document.",
                label: "Analyze and visualize data",
                modelId: config.ai.tools.sheet.analyze,
              },
            ]
          : []),
      ];
    }
    default: {
      return [];
    }
  }
};

export const documentAssistantRequest = (
  action: ReturnType<typeof documentAssistantActions>[number],
  documentId: string,
  revisionId: string
): DocumentAssistantRequest => ({
  message: `${action.instruction}\n\nTarget document: ${documentId}. Selected revision: ${revisionId}. Use readDocument to read this document, then use the document tools to apply the requested changes.`,
  modelId: action.modelId,
});
