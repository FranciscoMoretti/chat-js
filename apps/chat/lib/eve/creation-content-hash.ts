/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";

import type { UiToolName } from "@/lib/ai/types";

import type { ReadonlyEveMessageInput } from "./readonly-message-types";
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
