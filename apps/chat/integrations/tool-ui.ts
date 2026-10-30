import { installedToolUi } from "@/chatjs/generated/ui";
import type { ToolRendererRegistry } from "@/lib/ai/tool-renderer-registry";

export const ui = { ...installedToolUi } satisfies ToolRendererRegistry;
