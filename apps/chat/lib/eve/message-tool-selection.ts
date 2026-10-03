/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 */
import type { EveMessage } from "eve/client";
import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import type { UiToolName } from "../ai/types";
/* oxlint-enable import/no-relative-parent-imports */

const selection = z.object({ selectedTool: frontendToolsSchema.nullable() });

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null --
 * import/group-exports (#523): eveToolMetadata stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): eveToolMetadata's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveToolMetadata's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep eveToolMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep eveToolMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): eveToolMetadata preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Only app-owned, display-safe metadata belongs in shared messages and copies. */
export const eveToolMetadata = (
  selectedTool: UiToolName | null | undefined
) => ({ chatjs: { selectedTool: selectedTool ?? null } });
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null */

/* oxlint-disable import/group-exports, no-undefined, unicorn/no-null --
 * import/group-exports (#523): eveMessageTool stays exported at its declaration so its public contract is visible beside its implementation.
 * no-undefined (#519): eveMessageTool uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * unicorn/no-null (#570): eveMessageTool preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const eveMessageTool = (
  message: Pick<EveMessage, "metadata">
): UiToolName | null => {
  const value = message.metadata?.custom?.chatjs;
  return value === undefined ? null : selection.parse(value).selectedTool;
};
/* oxlint-enable import/group-exports, no-undefined, unicorn/no-null */
