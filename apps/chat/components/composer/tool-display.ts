import type { LucideIcon } from "lucide-react";
import { Wrench } from "lucide-react";

import type { UiToolName } from "@/lib/ai/types";
import { composerTools } from "@/tools/chatjs/composer-tools";
import { installedToolNames } from "@/tools/chatjs/installed-features";

export const getToolDisplay = (
  tool: UiToolName
):
  | {
      icon: LucideIcon;
      name: string;
      shortName: string;
    }
  | undefined => {
  if (!installedToolNames.has(tool)) {
    return;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: getToolDisplay has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return composerTools[tool] ?? { icon: Wrench, name: tool, shortName: tool };
};
