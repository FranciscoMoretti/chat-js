import type { PluginDefinition } from "./metadata";

export const hasPluginEntry = (
  plugin: Pick<PluginDefinition, "id" | "files">,
  file: string
): boolean => plugin.files.includes(`chatjs/plugins/${plugin.id}/${file}`);
