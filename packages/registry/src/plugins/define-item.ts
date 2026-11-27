import type { CreateIcon } from "../../create-icons";
import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../metadata";
import type { PluginDefinition } from "../../metadata";

type OwnedFile = NonNullable<RegistryItem["files"]>[number] & {
  target: string;
};
type PluginItem = Omit<RegistryItem, "type" | "meta" | "files"> & {
  icon?: CreateIcon;
  files: OwnedFile[];
};

export const definePluginItem = (
  { icon, ...item }: PluginItem,
  options: Omit<
    PluginDefinition,
    "id" | "kind" | "contractVersion" | "files"
  > = {}
) => ({
  ...item,
  type: "registry:item" as const,
  meta: {
    ...(icon && { icon }),
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
