import { Wrench } from "lucide-react";

import type { UiToolName } from "@/lib/ai/types";
import { composerTools } from "@/tools/chatjs/composer-tools";
import { installedToolNames } from "@/tools/chatjs/installed-features";

export const getToolDisplay = (tool: UiToolName) => {
  if (!installedToolNames.has(tool)) {
    return;
  }
  return composerTools[tool] ?? { icon: Wrench, name: tool, shortName: tool };
};
