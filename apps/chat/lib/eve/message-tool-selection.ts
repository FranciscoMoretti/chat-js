/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 */
import type { EveMessage } from "eve/client";
import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import type { UiToolName } from "../ai/types";
/* oxlint-enable import/no-relative-parent-imports */

const selection = z.object({ selectedTool: frontendToolsSchema.nullable() });

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null -- jsdoc/require-param (#534): eveToolMetadata's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): eveToolMetadata's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep eveToolMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep eveToolMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
unicorn/no-null (#570): eveToolMetadata preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** Only app-owned, display-safe metadata belongs in shared messages and copies. */
const eveToolMetadata = (selectedTool: UiToolName | null | undefined) => ({
  chatjs: { selectedTool: selectedTool ?? null },
});
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null */

/* oxlint-disable no-undefined, unicorn/no-null -- no-undefined (#519): eveMessageTool uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
unicorn/no-null (#570): eveMessageTool preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const eveMessageTool = (
  message: Pick<EveMessage, "metadata">
): UiToolName | null => {
  const value = message.metadata?.custom?.chatjs;
  return value === undefined ? null : selection.parse(value).selectedTool;
};
/* oxlint-enable no-undefined, unicorn/no-null */
export { eveMessageTool, eveToolMetadata };
