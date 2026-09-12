import type { ToolUIPart } from "ai";
import type { ComponentType } from "react";

import { ui } from "@/tools/chatjs/ui";

import type { InstalledTools, installedTools } from "./installed-tools";

export type InstalledToolName = keyof typeof installedTools;
export type InstalledToolType = `tool-${InstalledToolName & string}`;
export type InstalledToolUIPart = ToolUIPart<InstalledTools>;

export type InstalledToolPart<T extends InstalledToolType> = Extract<
  InstalledToolUIPart,
  { type: T }
>;

export type ToolRendererProps<T extends InstalledToolType> = {
  tool: InstalledToolPart<T>;
  messageId: string;
  isReadonly: boolean;
};

export type ToolRendererRegistry = {
  [K in InstalledToolType]?: ComponentType<ToolRendererProps<K>>;
};

export const toolRendererRegistry = ui satisfies ToolRendererRegistry;

export function isInstalledToolType(
  type: string
): type is keyof typeof toolRendererRegistry {
  return Object.hasOwn(toolRendererRegistry, type);
}
