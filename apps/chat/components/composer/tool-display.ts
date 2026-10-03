/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { Wrench } from "lucide-react";

import type { UiToolName } from "@/lib/ai/types";
import { composerTools } from "@/tools/chatjs/composer-tools";
import { installedToolNames } from "@/tools/chatjs/installed-features";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- getToolDisplay: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const getToolDisplay = (tool: UiToolName) => {
  if (!installedToolNames.has(tool)) {
    return;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: getToolDisplay has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return composerTools[tool] ?? { icon: Wrench, name: tool, shortName: tool };
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
