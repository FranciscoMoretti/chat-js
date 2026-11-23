import type { PluginDefinition } from "./metadata";

export type PluginEntry =
  | "router"
  | "chat-ui"
  | "layout-ui"
  | "uploads"
  | "model-visibility"
  | "instrumentation";

export const hasPluginEntry = (
  plugin: Pick<PluginDefinition, "id" | "files">,
  entry: PluginEntry
): boolean => plugin.files.includes(`chatjs/plugins/${plugin.id}/${entry}.ts`);
