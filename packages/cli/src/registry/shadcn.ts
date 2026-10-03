import {
  addRegistryItems,
  getRegistriesConfig,
  getRegistry,
  getRegistryItems,
} from "shadcn/registry";
import { registryItemSchema } from "shadcn/schema";

import { withRegistryTransport } from "./transport";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const registryUrl =
  "https://unpkg.com/@chat-js/registry@1/dist/r/{name}.json";
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
export const registryConfig = async (cwd: string) => {
  const config = await getRegistriesConfig(cwd);
  return {
    registries: {
      "@chatjs": process.env.CHATJS_REGISTRY_URL ?? registryUrl,
      ...config.registries,
    },
  };
};
/* oxlint-enable node/no-process-env */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
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
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
export const readItem = async (source: string, cwd: string) => {
  const [item] = await withRegistryTransport(
    async () =>
      await getRegistryItems([source], { config: await registryConfig(cwd) })
  );
  return registryItemSchema.parse(item);
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const listTools = async (cwd: string) => {
  const catalog = await withRegistryTransport(
    async () =>
      await getRegistry("@chatjs", { config: await registryConfig(cwd) })
  );
  return catalog.items.filter(
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
    (item): boolean => item.meta?.chatjs?.kind === "tool"
  );
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const installItems = async (
  sources: string[],
  cwd: string,
  overwrite = false
): Promise<void> => {
  await withRegistryTransport(
    async (): Promise<void> =>
      await addRegistryItems(sources, {
        config: await registryConfig(cwd),
        cwd,
        overwrite,
        silent: true,
      })
  );
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/group-exports */
