import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../metadata";
import type { PluginDefinition } from "../../metadata";

type OwnedFile = NonNullable<RegistryItem["files"]>[number] & {
  target: string;
};
type PluginItem = Omit<RegistryItem, "type" | "meta" | "files"> & {
  files: OwnedFile[];
};

export const definePluginItem = (
  item: PluginItem,
  options: Omit<
    PluginDefinition,
    "id" | "kind" | "contractVersion" | "files"
  > = {}
) => ({
  ...item,
  type: "registry:item" as const,
  meta: {
    chatjs: pluginDefinitionSchema.parse({
      ...options,
      contractVersion: 3,
      kind: "plugin",
      id: item.name,
      files: item.files.map(({ target }) => {
        if (!target.startsWith("~/")) {
          throw new Error(`Expected an app-relative plugin target: ${target}`);
        }
        return target.slice("~/".length);
      }),
    }),
  },
});
