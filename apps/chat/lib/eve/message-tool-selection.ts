import type { EveMessage } from "eve/client";
import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
import { frontendToolsSchema } from "@/lib/ai/types";

const selection = z.object({ selectedTool: frontendToolsSchema.nullable() });

/* oxlint-disable unicorn/no-null -- unicorn/no-null (#570): eveToolMetadata preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/**
 * Only app-owned, display-safe metadata belongs in shared messages and copies.
 * @param {UiToolName | null | undefined} selectedTool UI tool selection, with an absent selection represented by null in stored metadata.
 * @returns {{ chatjs: z.infer<typeof selection> }} The app namespace containing the selection, without owner or runtime identities.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatjs from message.metadata.custom; read custom from message.metadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const value = message.metadata?.custom?.chatjs;

  if (value === undefined) {
    return null;
  }
  return selection.parse(value).selectedTool;
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveMessageTool, eveToolMetadata); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-undefined, unicorn/no-null */
export { eveMessageTool, eveToolMetadata };
/* oxlint-enable import/no-named-export */
