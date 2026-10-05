import type { LucideIcon } from "lucide-react";
import { Wrench } from "lucide-react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
import { composerTools } from "@/tools/chatjs/composer-tools";
import { installedToolNames } from "@/tools/chatjs/installed-features";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getToolDisplay); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
