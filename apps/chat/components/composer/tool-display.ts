import type { LucideIcon } from "lucide-react";
import type { UiToolName } from "@/lib/ai/types";
import { Wrench } from "lucide-react";

import { composerTools } from "@/composition/generated/composer-tools";
import { installedToolNames } from "@/composition/generated/installed-tools";

export const getToolDisplay = (
  tool: UiToolName
):
  | {
      icon: LucideIcon;
      name: string;
      shortName: string;
    }
  | undefined =>
  installedToolNames.has(tool)
    ? (composerTools[tool] ?? { icon: Wrench, name: tool, shortName: tool })
    : undefined;
