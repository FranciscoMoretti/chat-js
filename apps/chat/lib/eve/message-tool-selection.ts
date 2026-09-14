import type { EveMessage } from "eve/client";
import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import type { UiToolName } from "../ai/types";

const selection = z.object({ selectedTool: frontendToolsSchema.nullable() });

/** Only app-owned, display-safe metadata belongs in shared messages and copies. */
export const eveToolMetadata = (
  selectedTool: UiToolName | null | undefined
) => ({ chatjs: { selectedTool: selectedTool ?? null } });

export const eveMessageTool = (
  message: Pick<EveMessage, "metadata">
): UiToolName | null => {
  const value = message.metadata?.custom?.chatjs;
  return value === undefined ? null : selection.parse(value).selectedTool;
};
