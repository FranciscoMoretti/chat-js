import type { ComponentType, FunctionComponent } from "react";
import type { InstalledTools } from "./installed-tools";
import type { ToolUIPart } from "ai";

import { isValidatedToolRenderer } from "./define-tool-renderer";
import { ui } from "@/tools/chatjs/ui";

type InstalledToolName = keyof InstalledTools;

type InstalledToolType = `tool-${InstalledToolName}`;

type InstalledToolUIPart = ToolUIPart<InstalledTools>;

type InstalledToolPart<ToolType extends InstalledToolType> = Extract<
  InstalledToolUIPart,
  { type: ToolType }
>;

/* oxlint-disable typescript/consistent-type-definitions -- Keep the exported closed-record props alias and its implicit Record<string, unknown> assignability; an augmentable interface changes that contract. */
type ToolRendererProps<ToolType extends InstalledToolType> = {
  tool: InstalledToolPart<ToolType>;
  messageId: string;
  isReadonly: boolean;
};
/* oxlint-enable typescript/consistent-type-definitions */

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
    return;
  }
  const renderer = toolRendererRegistry[type];
  if (isValidatedToolRenderer(renderer)) {
    // oxlint-disable-next-line typescript/consistent-return -- #580: getEveInstalledToolRenderer has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return renderer;
  }
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getEveInstalledToolRenderer, isInstalledToolType, toolRendererRegistry); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  getEveInstalledToolRenderer,
  isInstalledToolType,
  toolRendererRegistry,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (InstalledToolName, InstalledToolPart, InstalledToolType, InstalledToolUIPart, ToolRendererProps, ToolRendererRegistry); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type {
  InstalledToolName,
  InstalledToolPart,
  InstalledToolType,
  InstalledToolUIPart,
  ToolRendererProps,
  ToolRendererRegistry,
};
/* oxlint-enable import/no-named-export */
