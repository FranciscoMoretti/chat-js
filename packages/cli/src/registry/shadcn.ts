import {
  addRegistryItems,
  getRegistriesConfig,
  getRegistry,
  getRegistryItems,
} from "shadcn/registry";
import { registryItemSchema } from "shadcn/schema";

import { withRegistryTransport } from "./transport";

export const registryUrl =
  "https://unpkg.com/@chat-js/registry@1/dist/r/{name}.json";
export const registryConfig = async (cwd: string) => {
  const config = await getRegistriesConfig(cwd);
  return {
    registries: {
      "@chatjs": process.env.CHATJS_REGISTRY_URL ?? registryUrl,
      ...config.registries,
    },
  };
};
export const itemAddress = (
  source: string,
  kind: "gateway" | "tool" | "storage"
): string => {
  if (/^[a-z][a-z0-9-]*$/u.test(source)) {
    const suffix =
      kind === "tool" || (kind === "gateway" && source.endsWith("-gateway"))
        ? ""
        : `-${kind}`;
    return `@chatjs/${source}${suffix}`;
  }
  return source;
};
export const readItem = async (source: string, cwd: string) => {
  const [item] = await withRegistryTransport(
    async () =>
      await getRegistryItems([source], { config: await registryConfig(cwd) })
  );
  return registryItemSchema.parse(item);
};
export const listTools = async (cwd: string) => {
  const catalog = await withRegistryTransport(
    async () =>
      await getRegistry("@chatjs", { config: await registryConfig(cwd) })
  );
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
  return catalog.items.filter((item) => item.meta?.chatjs?.kind === "tool");
};
export const installItems = async (
  sources: string[],
  cwd: string,
  overwrite = false
): Promise<void> => {
  await withRegistryTransport(
    async () =>
      await addRegistryItems(sources, {
        config: await registryConfig(cwd),
        cwd,
        overwrite,
        silent: true,
      })
  );
};
