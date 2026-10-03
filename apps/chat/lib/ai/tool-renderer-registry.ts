import type { ToolUIPart } from "ai";
import { createElement } from "react";
import type { ComponentType } from "react";

import { ui } from "@/tools/chatjs/ui";

import { isValidatedToolRenderer } from "./define-tool-renderer";
import type { InstalledTools } from "./installed-tools";

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): InstalledToolName stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type InstalledToolName = keyof InstalledTools;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports --
 * import/group-exports (#523): InstalledToolType stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type InstalledToolType = `tool-${InstalledToolName}`;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports --
 * import/group-exports (#523): InstalledToolUIPart stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type InstalledToolUIPart = ToolUIPart<InstalledTools>;
/* oxlint-enable import/group-exports */

/* oxlint-disable id-length, import/group-exports --
 * id-length (#506): InstalledToolPart uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): InstalledToolPart stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type InstalledToolPart<T extends InstalledToolType> = Extract<
  InstalledToolUIPart,
  { type: T }
>;
/* oxlint-enable id-length, import/group-exports */

/* oxlint-disable id-length, import/group-exports, typescript/consistent-type-definitions --
 * id-length (#506): ToolRendererProps uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): ToolRendererProps stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/consistent-type-definitions (#559): ToolRendererProps preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type ToolRendererProps<T extends InstalledToolType> = {
  tool: InstalledToolPart<T>;
  messageId: string;
  isReadonly: boolean;
};
/* oxlint-enable id-length, import/group-exports, typescript/consistent-type-definitions */

/* oxlint-disable id-length, import/group-exports --
 * id-length (#506): ToolRendererRegistry uses K as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): ToolRendererRegistry stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type ToolRendererRegistry = {
  [K in InstalledToolType]?: ComponentType<ToolRendererProps<K>>;
};
/* oxlint-enable id-length, import/group-exports */

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): toolRendererRegistry stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const toolRendererRegistry: ToolRendererRegistry = ui;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): isInstalledToolType stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const isInstalledToolType = (
  type: string
): type is keyof typeof toolRendererRegistry =>
  Object.hasOwn(toolRendererRegistry, type);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/group-exports (#523): getEveInstalledToolRenderer stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): getEveInstalledToolRenderer's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getEveInstalledToolRenderer's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-undefined (#519): getEveInstalledToolRenderer uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep getEveInstalledToolRenderer's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveInstalledToolRenderer's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
/** EVE only invokes renderers that validate persisted input and output themselves. */
export const getEveInstalledToolRenderer = (type: string) => {
  if (!isInstalledToolType(type)) {
    return;
  }
  const renderer = toolRendererRegistry[type];
  // oxlint-disable-next-line typescript/consistent-return -- #580: getEveInstalledToolRenderer has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return isValidatedToolRenderer(renderer) ? renderer : undefined;
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable id-length, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * id-length (#506): renderInstalledTool uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): renderInstalledTool stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): renderInstalledTool's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): renderInstalledTool's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep renderInstalledTool's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep renderInstalledTool's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): renderInstalledTool accepts props: ToolRendererProps<T>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): renderInstalledTool preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Keep the installed part discriminator correlated with its renderer props. */
export const renderInstalledTool = <T extends InstalledToolType>(
  type: T,
  props: ToolRendererProps<T>
) => {
  const Renderer = toolRendererRegistry[type];
  return Renderer ? createElement(Renderer, props) : null;
};
/* oxlint-enable id-length, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
