import type { ToolDefinition } from "../../../registry/metadata";

export const validateProviderSelection = (
  installed: ToolDefinition[],
  requested: ToolDefinition[]
) => {
  const definitions = new Map(installed.map((item) => [item.id, item]));
  for (const item of requested) {
    definitions.set(item.id, item);
  }
  const selections = new Map<string, string>();
  for (const item of definitions.values()) {
    if (!item.slot) {
      continue;
    }
    const previous = selections.get(item.slot);
    if (previous) {
      throw new Error(
        `Only one ${item.slot} provider can be installed. Remove ${previous} before installing ${item.id}.`
      );
    }
    selections.set(item.slot, item.id);
  }
};
