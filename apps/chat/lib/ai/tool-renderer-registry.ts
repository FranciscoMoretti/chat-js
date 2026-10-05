import type { ToolUIPart } from "ai";
import { createElement } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComponentType, FunctionComponent, ReactElement } from "react";
/* oxlint-enable sort-imports */

import { ui } from "@/tools/chatjs/ui";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { isValidatedToolRenderer } from "./define-tool-renderer";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { InstalledTools } from "./installed-tools";
/* oxlint-enable sort-imports */

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

/* oxlint-disable unicorn/no-null -- React renders no installed component when registry lookup is absent; preserve the established null result. */
/** Create the installed tool element while retaining the selected discriminator's prop correlation.
 * @param {ToolType} type Installed discriminator selecting the corresponding renderer.
 * @param {ToolRendererProps<ToolType>} props Original native tool data and display ownership forwarded to React.
 * @returns {ReactElement<ToolRendererProps<ToolType>> | null} The installed renderer element with its original props, or null when absent.
 */
const renderInstalledTool = <ToolType extends InstalledToolType>(
  type: ToolType,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native tool-part JSON collections and callback props are forwarded directly to React.createElement; preserve the installed component input contract.
  props: ToolRendererProps<ToolType>
): ReactElement<ToolRendererProps<ToolType>> | null => {
  const Renderer = toolRendererRegistry[type];
  if (Renderer) {
    return createElement(Renderer, props);
  }
  return null;
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getEveInstalledToolRenderer, isInstalledToolType, renderInstalledTool, toolRendererRegistry); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable unicorn/no-null */
export {
  getEveInstalledToolRenderer,
  isInstalledToolType,
  renderInstalledTool,
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
