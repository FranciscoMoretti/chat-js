import { installedPlugins as installedPluginsInput } from "@/chatjs/generated/installed";

export const installedPlugins: ReadonlySet<string> = new Set(
  installedPluginsInput
);
