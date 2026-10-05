/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyEveMessageInput } from "./readonly-message-types";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveCreationContentHash); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

export const eveCreationContentHash = (
  message: ReadonlyEveMessageInput,
  selectedTool?: UiToolName
): string | undefined => {
  // Preserve the identity of already-reserved requests with automatic tools.
  if (!selectedTool && typeof message === "string") {
    return;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: eveCreationContentHash has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return createHash("sha256")
    .update(JSON.stringify(selectedTool ? { message, selectedTool } : message))
    .digest("hex");
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
