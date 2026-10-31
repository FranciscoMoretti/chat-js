import { installedToolDefinitions } from "@/chatjs/generated/tool-definitions";
import { validateToolDefinitions } from "@/lib/ai/tool-definition";
import type { ToolDefinition } from "@/lib/ai/tool-definition";

export const toolDefinitions: readonly ToolDefinition[] =
  validateToolDefinitions([...installedToolDefinitions]);
