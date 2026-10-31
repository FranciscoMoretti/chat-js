import type { DocumentAssistantAction } from "@/chatjs/core/documents/contracts";
import { config } from "@/lib/config";

const documentAssistantActions = (): DocumentAssistantAction[] => [
  {
    instruction:
      "Add final polish, check grammar, add section titles for structure, and ensure the document reads smoothly.",
    label: "Add final polish",
    modelId: config.ai.tools.text.polish,
  },
];
export { documentAssistantActions };
