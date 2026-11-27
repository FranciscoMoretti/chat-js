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
import { storageSettings } from "./create-providers";
import type { AddSelectionFlags } from "./selection-options";

export const canPickItems = (yes: boolean) =>
  !yes && process.stdin.isTTY && process.stdout.isTTY;

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
    if (field.add === "argument") {
      const items = await chooseMany(field.label, choices, []);
      if (items !== undefined && items.length > 0) {
        return { items };
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
    if (definition?.kind === "storage" && definition.configKeys.length > 0) {
      const options = await storageSettings(definition.id, definition, {});
      if (options === undefined) {
        continue;
      }
      return {
        items: [],
        flags: { [fieldKey]: address, storageConfig: options },
      };
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
