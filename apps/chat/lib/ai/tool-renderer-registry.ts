import type { ToolUIPart } from "ai";
import { createElement } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComponentType } from "react";
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

/* oxlint-disable id-length -- id-length (#506): InstalledToolPart uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology. */
type InstalledToolPart<T extends InstalledToolType> = Extract<
  InstalledToolUIPart,
  { type: T }
>;
/* oxlint-enable id-length */

/* oxlint-disable id-length, typescript/consistent-type-definitions -- id-length (#506): ToolRendererProps uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
typescript/consistent-type-definitions (#559): ToolRendererProps preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
type ToolRendererProps<T extends InstalledToolType> = {
  tool: InstalledToolPart<T>;
  messageId: string;
  isReadonly: boolean;
};
/* oxlint-enable id-length, typescript/consistent-type-definitions */

/* oxlint-disable id-length -- id-length (#506): ToolRendererRegistry uses K as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology. */
type ToolRendererRegistry = {
  [K in InstalledToolType]?: ComponentType<ToolRendererProps<K>>;
};
/* oxlint-enable id-length */

const toolRendererRegistry: ToolRendererRegistry = ui;

const isInstalledToolType = (
  type: string
): type is keyof typeof toolRendererRegistry =>
  Object.hasOwn(toolRendererRegistry, type);

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- jsdoc/require-param (#534): getEveInstalledToolRenderer's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): getEveInstalledToolRenderer's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
no-undefined (#519): getEveInstalledToolRenderer uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/explicit-function-return-type (#560): Keep getEveInstalledToolRenderer's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep getEveInstalledToolRenderer's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
/** EVE only invokes renderers that validate persisted input and output themselves. */
const getEveInstalledToolRenderer = (type: string) => {
  if (!isInstalledToolType(type)) {
    return;
  }
  const renderer = toolRendererRegistry[type];
  // oxlint-disable-next-line typescript/consistent-return -- #580: getEveInstalledToolRenderer has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return isValidatedToolRenderer(renderer) ? renderer : undefined;
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable id-length, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- id-length (#506): renderInstalledTool uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
jsdoc/require-param (#534): renderInstalledTool's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): renderInstalledTool's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep renderInstalledTool's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep renderInstalledTool's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): renderInstalledTool accepts props: ToolRendererProps<T>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): renderInstalledTool preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** Keep the installed part discriminator correlated with its renderer props. */
const renderInstalledTool = <T extends InstalledToolType>(
  type: T,
  props: ToolRendererProps<T>
) => {
  const Renderer = toolRendererRegistry[type];
  return Renderer ? createElement(Renderer, props) : null;
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getEveInstalledToolRenderer, isInstalledToolType, renderInstalledTool, toolRendererRegistry); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable id-length, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
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
