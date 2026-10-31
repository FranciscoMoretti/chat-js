import type { DocumentAssistantAction } from "@/chatjs/core/documents/contracts";
import { config } from "@/lib/config";

const documentAssistantActions = (): DocumentAssistantAction[] => [
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
export { documentAssistantActions };
