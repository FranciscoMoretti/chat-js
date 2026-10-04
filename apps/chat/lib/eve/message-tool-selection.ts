/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 */
import type { EveMessage } from "eve/client";
import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import type { UiToolName } from "../ai/types";
/* oxlint-enable import/no-relative-parent-imports */

const selection = z.object({ selectedTool: frontendToolsSchema.nullable() });

/* oxlint-disable unicorn/no-null -- unicorn/no-null (#570): eveToolMetadata preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/**
 * Only app-owned, display-safe metadata belongs in shared messages and copies.
 * @param selectedTool UI tool selection, with an absent selection represented by null in stored metadata.
 * @returns The app namespace containing the selection, without owner or runtime identities.
 */
const eveToolMetadata = (
  selectedTool: UiToolName | null | undefined
): { chatjs: z.infer<typeof selection> } => ({
  chatjs: { selectedTool: selectedTool ?? null },
});
/* oxlint-enable unicorn/no-null */

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
