import type { StorageDefinition } from "../../../registry/metadata";
import { log } from "@clack/prompts";
import {
  addFieldKeys,
  createCatalog,
  registryChoices,
} from "../../../registry/create-catalog";
import { pluginItems } from "../../../registry/src/plugins/catalog";
import { installationCatalog } from "../../../registry/installation-catalog";
import { listRegistryItems } from "#cli/registry/shadcn";
import { readInstalledPlugins } from "#cli/utils/installed-plugins";
import { back, choose, chooseMany, promptValue } from "./prompts";
import { readProviderId } from "#cli/utils/provider-config";
import { readInstalledStorageOptions } from "./storage-provider";
import { storageSettings } from "./create-providers";
import type { AddSelectionFlags } from "./selection-options";

export const canPickItems = (yes: boolean) =>
  !yes && process.stdin.isTTY && process.stdout.isTTY;

const promptProjectStorage = async (
  cwd: string,
  definition: Readonly<StorageDefinition>
): Promise<Pick<AddSelectionFlags, "storageConfig"> | undefined> => {
  if ((definition.configFields?.length ?? 0) === 0) {
    return {};
  }
  let current: Record<string, unknown> = {};
  if ((await readProviderId(cwd, "storage")) === definition.id) {
    const action = await choose("Storage settings", [
      { value: "keep", label: "Keep current settings" },
      { value: "edit", label: "Edit settings" },
      back,
    ]);
    if (action === back.value) {
      return undefined;
    }
    if (action === "keep") {
      return {};
    }
    current = await readInstalledStorageOptions(cwd);
  }
  const storageConfig = await storageSettings(
    definition.id,
    definition,
    current
  );
  return storageConfig === undefined ? undefined : { storageConfig };
};

export const promptAddSelection = async (
  cwd: string,
  filesOnly: boolean
): Promise<{ items: string[]; flags?: AddSelectionFlags } | undefined> => {
  const categories = addFieldKeys.flatMap((key) => {
    const field = createCatalog[key];
    return "source" in field ? [{ value: key, label: field.label, field }] : [];
  });
  const external = { value: "external", label: "Enter a registry address" };
  let catalog: ReturnType<typeof installationCatalog> | undefined;
  for (;;) {
    /* eslint-disable no-await-in-loop -- Back returns to the category picker. */
    const key = await choose("What would you like to add?", [
      ...categories,
      external,
      back,
    ]);
    if (key === back.value) {
      return undefined;
    }
    if (key === external.value) {
      const address = await promptValue("Enter a registry item address");
      if (address !== undefined) {
        return { items: [address] };
      }
      continue;
    }
    const category = categories.find(({ value }) => value === key);
    if (!category) {
      continue;
    }
    const { field, value: fieldKey } = category;
    catalog ??= installationCatalog(await listRegistryItems(cwd));
    const choices = registryChoices(catalog, field.source, "address");
    if (choices.length === 0) {
      log.info(`No items available in ${field.label}.`);
      continue;
    }
    if (field.kind === "multiple") {
      const items = await chooseMany(field.label, choices, []);
      if (items !== undefined && items.length > 0) {
        return field.add === "flag"
          ? { items: [], flags: { [fieldKey]: items } }
          : { items };
      }
      continue;
    }
    const address = await choose(field.label, [...choices, back]);
    if (address === back.value) {
      continue;
    }
    if (filesOnly) {
      return { items: [address] };
    }
    const definition = catalog.find(
      (item) => `@chatjs/${item.name}` === address
    )?.definition;
    if (definition?.kind === "storage") {
      const settings = await promptProjectStorage(cwd, definition);
      if (settings === undefined) {
        continue;
      }
      return { items: [], flags: { [fieldKey]: address, ...settings } };
    }
    return { items: [], flags: { [fieldKey]: address } };
    /* eslint-enable no-await-in-loop */
  }
};

export const promptRemoveSelection = async (cwd: string) => {
  const plugins = await readInstalledPlugins(cwd);
  if (!plugins.length) {
    log.info("This app has no installed plugins to remove.");
    return [];
  }
  const catalog = registryChoices(
    installationCatalog(pluginItems),
    createCatalog.plugin.source
  );
  return await chooseMany(
    "Which installed plugins would you like to remove?",
    plugins.map(
      ({ id }) =>
        catalog.find(({ value }) => value === id) ?? { value: id, label: id }
    ),
    []
  );
};
