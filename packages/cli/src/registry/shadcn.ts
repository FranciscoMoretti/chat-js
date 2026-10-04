import {
  addRegistryItems,
  getRegistriesConfig,
  getRegistry,
  getRegistryItems,
} from "shadcn/registry";
import { registryItemSchema } from "shadcn/schema";

import { withRegistryTransport } from "./transport";

const registryUrl = "https://unpkg.com/@chat-js/registry@1/dist/r/{name}.json";

const registryConfig = async (
  cwd: string
): Promise<Awaited<ReturnType<typeof getRegistriesConfig>>> => {
  const config = await getRegistriesConfig(cwd);
  return {
    registries: {
      // oxlint-disable-next-line node/no-process-env -- CLI registry selection honors CHATJS_REGISTRY_URL for this process, then configured registries override it; moving the read to caller defaults would change this existing per-operation boundary.
      "@chatjs": process.env.CHATJS_REGISTRY_URL ?? registryUrl,
      ...config.registries,
    },
  };
};

const itemAddress = (
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

const readItem = async (
  source: string,
  cwd: string
): Promise<ReturnType<typeof registryItemSchema.parse>> => {
  const [item] = await withRegistryTransport(
    async () =>
      await getRegistryItems([source], { config: await registryConfig(cwd) })
  );
  return registryItemSchema.parse(item);
};

const listTools = async (
  cwd: string
): Promise<Awaited<ReturnType<typeof getRegistry>>["items"]> => {
  const catalog = await withRegistryTransport(
    async () =>
      await getRegistry("@chatjs", { config: await registryConfig(cwd) })
  );
  return catalog.items.filter(
    (item: Readonly<{ meta?: Readonly<Record<string, unknown>> }>): boolean => {
      const chatjs = item.meta?.chatjs;
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
    const config = await registryConfig(cwd);
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
  listTools,
  readItem,
  registryConfig,
  registryUrl,
};
