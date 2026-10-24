import type { DocumentAssistantAction } from "@/lib/eve/document-contracts";
import { config } from "@/lib/config";
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

const documentAssistantActions = (): DocumentAssistantAction[] => [
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
export { documentAssistantActions };
