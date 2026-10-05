import {
  addRegistryItems,
  getRegistriesConfig,
  getRegistry,
  getRegistryItems,
} from "shadcn/registry";
import { registryItemSchema } from "shadcn/schema";

import { withRegistryTransport } from "./transport";

const registryUrl = "https://unpkg.com/@chat-js/registry@1/dist/r/{name}.json";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve registryConfig's awaited sequencing and rejected-Promise behavior. */
const registryConfig = async (
  cwd: string
): Promise<Awaited<ReturnType<typeof getRegistriesConfig>>> => {
  const config = await getRegistriesConfig(cwd);
  return {
    registries: {
      // oxlint-disable-next-line node/no-process-env -- CLI registry selection honors CHATJS_REGISTRY_URL for this process, then configured registries override it; moving the read to caller defaults would change this existing per-operation boundary.
      "@chatjs": process.env.CHATJS_REGISTRY_URL ?? registryUrl,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config.registries own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...config.registries,
    },
  };
};
/* oxlint-enable oxc/no-async-await */
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readItem's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve listTools's awaited sequencing and rejected-Promise behavior. */
const listTools = async (
  cwd: string
): Promise<Awaited<ReturnType<typeof getRegistry>>["items"]> => {
  const catalog = await withRegistryTransport(
    async () =>
      await getRegistry("@chatjs", { config: await registryConfig(cwd) })
  );
  return catalog.items.filter(
    (item: Readonly<{ meta?: Readonly<Record<string, unknown>> }>): boolean => {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatjs from item.meta; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve installItems's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (installItems, itemAddress, listTools, readItem, registryConfig, registryUrl); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export {
  installItems,
  itemAddress,
  listTools,
  readItem,
  registryConfig,
  registryUrl,
};
/* oxlint-enable import/no-named-export */
