import { registryResolution } from "./resolution-context";
import {
  addRegistryItems,
  getRegistriesConfig,
  getRegistry,
  getRegistryItems,
} from "shadcn/registry";
import { registryItemSchema, rawConfigSchema } from "shadcn/schema";
import type { Config } from "shadcn/schema";
import path from "node:path";
import { optionalFile } from "#cli/utils/installation-files";
import { resolveNativeProjectConfig } from "#cli/helpers/native-project-config";

import { withRegistryTransport } from "./transport";

const registryUrl =
  "https://unpkg.com/@chat-js/registry@0.2.0-beta.10/dist/r/{name}.json";

const registryConfig = async (
  cwd: string
): Promise<
  Partial<Config> & Awaited<ReturnType<typeof getRegistriesConfig>>
> => {
  const config = await getRegistriesConfig(cwd);
  const source = await optionalFile(path.join(cwd, "components.json"));
  const native = source
    ? rawConfigSchema.partial().parse(JSON.parse(source.toString()))
    : {};
  return {
    ...native,
    registries: {
      "@chatjs": process.env.CHATJS_REGISTRY_URL ?? registryUrl,
      ...config.registries,
    },
  };
};
const itemAddress = (
  source: string,
  kind: "gateway" | "tool" | "storage" | "sandbox"
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

const readItem = async (
  source: string,
  cwd: string
): Promise<ReturnType<typeof registryItemSchema.parse>> => {
  const snapshot = registryResolution.getStore();
  if (snapshot) {
    const recorded = snapshot.get(source);
    if (!recorded) {
      throw new Error(
        `Recipe does not contain ${source}. Resolve a new recipe explicitly; no newer revision was fetched.`
      );
    }
    return registryItemSchema.parse(recorded);
  }
  const [item] = await withRegistryTransport(
    async () =>
      await getRegistryItems([source], { config: await registryConfig(cwd) })
  );
  return registryItemSchema.parse(item);
};
const listRegistryItems = async (cwd: string) => {
  const catalog = await withRegistryTransport(
    async () =>
      await getRegistry("@chatjs", { config: await registryConfig(cwd) })
  );
  return catalog.items;
};
const listTools = async (
  cwd: string
): Promise<Awaited<ReturnType<typeof listRegistryItems>>> => {
  const items = await listRegistryItems(cwd);
  return items.filter(
    (item: Readonly<{ meta?: Readonly<Record<string, unknown>> }>): boolean => {
      const { chatjs } = item.meta ?? {};
      return (
        typeof chatjs === "object" &&
        chatjs !== null &&
        "kind" in chatjs &&
        chatjs.kind === "tool"
      );
    }
  );
};
const installItems = async (
  sources: readonly string[],
  cwd: string,
  overwrite = false
): Promise<void> => {
  await withRegistryTransport(async (): Promise<void> => {
    const config = await resolveNativeProjectConfig(
      cwd,
      await registryConfig(cwd)
    );
    // The SDK's mutable array annotation describes its installation work list;
    // keep that ownership separate from the caller's readonly source selection.
    await addRegistryItems([...sources], {
      config,
      cwd,
      overwrite,
      silent: true,
    });
  });
};
export {
  installItems,
  itemAddress,
  listRegistryItems,
  listTools,
  readItem,
  registryConfig,
  registryUrl,
};
