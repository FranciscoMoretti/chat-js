import type { ComponentType, FunctionComponent } from "react";
import type { InstalledTools } from "./installed-tools";
import type { ToolUIPart } from "ai";

import { isValidatedToolRenderer } from "@/chatjs/core/tools/define-renderer";
import { ui } from "@/integrations/tools/ui";

type InstalledToolName = keyof InstalledTools;

type InstalledToolType = `tool-${InstalledToolName}`;

type InstalledToolUIPart = ToolUIPart<InstalledTools>;

type InstalledToolPart<ToolType extends InstalledToolType> = Extract<
  InstalledToolUIPart,
  { type: ToolType }
>;

interface ToolRendererProps<ToolType extends InstalledToolType> {
  tool: InstalledToolPart<ToolType>;
  messageId: string;
  isReadonly: boolean;
}

type ToolRendererRegistry = {
  [ToolType in InstalledToolType]?: ComponentType<ToolRendererProps<ToolType>>;
};

const toolRendererRegistry: ToolRendererRegistry = ui;

const isInstalledToolType = (
  type: string
): type is keyof typeof toolRendererRegistry =>
  Object.hasOwn(toolRendererRegistry, type);

/** Resolve only installed function renderers marked as validating their persisted input/output.
 * @param {string} type Installed tool discriminator used to read the native renderer registry.
 * @returns {(FunctionComponent<{isReadonly: boolean; messageId: string; tool: unknown}> & {validatedToolRenderer: true}) | undefined} The original marked renderer, or undefined for unknown and unvalidated entries.
 */
const getEveInstalledToolRenderer = (
  type: string
):
  | (FunctionComponent<{
      isReadonly: boolean;
      messageId: string;
      tool: unknown;
    }> & { validatedToolRenderer: true })
  | undefined => {
  if (!isInstalledToolType(type)) {
    return undefined;
  }
  const renderer = toolRendererRegistry[type];
  if (isValidatedToolRenderer(renderer)) {
    return renderer;
  }
  return undefined;
};

export {
  getEveInstalledToolRenderer,
  isInstalledToolType,
  toolRendererRegistry,
};
export type {
  InstalledToolName,
  InstalledToolPart,
  InstalledToolType,
  InstalledToolUIPart,
  ToolRendererProps,
  ToolRendererRegistry,
};
