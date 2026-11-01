import { installedToolDefinitions } from "@/chatjs/generated/tool-definitions";
import { validateToolDefinitions } from "@/chatjs/core/tools/tool-definition";
import type { ToolDefinition } from "@/chatjs/core/tools/tool-definition";

export const toolDefinitions: readonly ToolDefinition[] =
  validateToolDefinitions([...installedToolDefinitions]);
