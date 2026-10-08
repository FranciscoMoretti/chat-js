import type { DocumentAssistantRequest } from "./document-contracts";
import { config } from "@/lib/config";
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

interface DocumentAssistantAction {
  instruction: string;
  label: string;
  modelId: typeof config.ai.tools.text.polish;
}

const sheetDocumentAssistantActions = (): DocumentAssistantAction[] => [
  {
    instruction: "Format and clean the spreadsheet data.",
    label: "Format and clean data",
    modelId: config.ai.tools.sheet.format,
  },
  // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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

const documentAssistantActions = (
  kind: "text" | "code" | "sheet"
): DocumentAssistantAction[] => {
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
      return sheetDocumentAssistantActions();
    }
    default: {
      return [];
    }
  }
};

const documentAssistantRequest = (
  action: Readonly<ReturnType<typeof documentAssistantActions>[number]>,
  documentId: string,
  revisionId: string
): DocumentAssistantRequest => ({
  message: `${action.instruction}\n\nTarget document: ${documentId}. Selected revision: ${revisionId}. Use readDocument to read this document, then use the document tools to apply the requested changes.`,
  modelId: action.modelId,
});

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (documentAssistantActions, documentAssistantRequest); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { documentAssistantActions, documentAssistantRequest };
/* oxlint-enable import/no-named-export */
