import type { ToolUIPart } from "ai";
import { createElement } from "react";
import type { ComponentType } from "react";

import { ui } from "@/tools/chatjs/ui";

import { isValidatedToolRenderer } from "./define-tool-renderer";
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

export const isInstalledToolType = (
  type: string
): type is keyof typeof toolRendererRegistry =>
  Object.hasOwn(toolRendererRegistry, type);

/** EVE only invokes renderers that validate persisted input and output themselves. */
export const getEveInstalledToolRenderer = (type: string) => {
  if (!isInstalledToolType(type)) {
    return;
  }
  const renderer = toolRendererRegistry[type];
  return isValidatedToolRenderer(renderer) ? renderer : undefined;
};

/** Keep the installed part discriminator correlated with its renderer props. */
export const renderInstalledTool = <T extends InstalledToolType>(
  type: T,
  props: ToolRendererProps<T>
) => {
  const Renderer = toolRendererRegistry[type];
  return Renderer ? createElement(Renderer, props) : null;
};
