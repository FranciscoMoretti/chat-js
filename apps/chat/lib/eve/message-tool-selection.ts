import { z } from "zod";

import type { UiToolName } from "@/lib/ai/types";
import { frontendToolsSchema } from "@/lib/ai/types";

import type { ReadonlyEveMessageMetadata } from "./readonly-message-types";

const selection = z.object({ selectedTool: frontendToolsSchema.nullable() });

/**
 * Only app-owned, display-safe metadata belongs in shared messages and copies.
 * @param {UiToolName | null | undefined} selectedTool UI tool selection, with an absent selection represented by null in stored metadata.
 * @returns {{ chatjs: z.infer<typeof selection> }} The app namespace containing the selection, without owner or runtime identities.
 */
const eveToolMetadata = (
  selectedTool: UiToolName | null | undefined
): { chatjs: z.infer<typeof selection> } => ({
  chatjs: { selectedTool: selectedTool ?? null },
});

const eveMessageTool = (message: {
  readonly metadata?: ReadonlyEveMessageMetadata;
}): UiToolName | null => {
  const value = message.metadata?.custom?.chatjs;

  if (value === undefined) {
    return null;
  }
  return selection.parse(value).selectedTool;
};
export { eveMessageTool, eveToolMetadata };
