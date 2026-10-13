import type { ReadonlyEveMessageInput } from "./readonly-message-types";
import type { UiToolName } from "@/lib/ai/types";
import { createHash } from "node:crypto";

export const eveCreationContentHash = (
  message: ReadonlyEveMessageInput,
  selectedTool?: UiToolName
): string | undefined => {
  // Preserve the identity of already-reserved requests with automatic tools.
  if (!selectedTool && typeof message === "string") {
    return undefined;
  }
  return createHash("sha256")
    .update(JSON.stringify(selectedTool ? { message, selectedTool } : message))
    .digest("hex");
};
