import { createHash } from "node:crypto";

import type { UiToolName } from "../ai/types";
import type { EveMessageInput } from "./message-input";

export const eveCreationContentHash = (
  message: EveMessageInput,
  selectedTool?: UiToolName
) => {
  // Preserve the identity of already-reserved requests with automatic tools.
  if (!selectedTool && typeof message === "string") {
    return;
  }
  return createHash("sha256")
    .update(JSON.stringify(selectedTool ? { message, selectedTool } : message))
    .digest("hex");
};
