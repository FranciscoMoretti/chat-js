import { registryItems } from "../../../../packages/registry/registry-items";
import { toolDefinitionSchema } from "../../../../packages/registry/metadata";

/** Resolve the same item IDs as installation; fixture cases use runtime tool names. */
export const previewTools = (
  selected: readonly string[]
): ReadonlySet<string> =>
  new Set(
    registryItems.flatMap((item) => {
      const parsed = toolDefinitionSchema.safeParse(item.meta?.chatjs);
      if (!parsed.success || !selected.includes(parsed.data.id)) {
        return [];
      }
      const definition = parsed.data;
      return definition.slot
        ? [definition.slot]
        : definition.tools.map((tool) => tool.toolExport);
    })
  );
