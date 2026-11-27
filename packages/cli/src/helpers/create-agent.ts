import { log } from "@clack/prompts";
import type { Option } from "@clack/prompts";
import { back, choose, chooseMany, promptValue } from "#cli/helpers/prompts";
import { editSandbox } from "#cli/helpers/create-providers";
import { itemAddress, listTools, readItem } from "#cli/registry/shadcn";
import { registryItems } from "../../../registry/registry-items";
import { installationCatalog } from "../../../registry/installation-catalog";
import type { InstallationSelection } from "../../../registry/installation";
import { toolDefinitionSchema } from "../../../registry/metadata";
import {
  defaultAgentConfiguration,
  enabledEveDefaultTools,
  eveDefaultToolIds,
} from "../../../registry/agent-configuration";
import {
  eveCategories,
  eveCompositionIssue,
  eveRegistriesSchema,
} from "../../../registry/eve-catalog";
import { createCatalog } from "../../../registry/create-catalog";
import type { MediaKind } from "../../../registry/provider-capabilities";

const mediaSlots = { image: "generateImage", video: "generateVideo" } as const;

const toolOptions = (
  items: Parameters<typeof installationCatalog>[0]
): Option<string>[] =>
  installationCatalog(items).map((item) => ({
    value: item.name,
    label: item.title,
    hint: item.description,
  }));

export const externalMedia = async (
  cwd: string,
  kind: MediaKind,
  source: string
): Promise<string> => {
  const address = itemAddress(source, "tool");
  const item = await readItem(address, cwd);
  const definition = toolDefinitionSchema.parse(item.meta?.chatjs);
  if (definition.slot !== mediaSlots[kind]) {
    throw new Error(`Selected tool must declare the ${mediaSlots[kind]} slot.`);
  }
  return address;
};

const appToolOptions = async (cwd: string): Promise<Option<string>[]> => {
  const builtins = toolOptions(
    registryItems.filter(
      (item) => toolDefinitionSchema.safeParse(item.meta?.chatjs).success
    )
  );
  try {
    const items = await listTools(cwd);
    const discovered = items.filter((item) => {
      const definition = toolDefinitionSchema.safeParse(item.meta?.chatjs);
      return (
        !("hidden" in item && item.hidden === true) &&
        definition.success &&
        definition.data.slot === undefined &&
        !builtins.some((builtin) => builtin.value === definition.data.id)
      );
    });
    return [...builtins, ...toolOptions(discovered)];
  } catch {
    return builtins;
  }
};

const editAppTools = async (
  selection: InstallationSelection,
  cwd: string
): Promise<void> => {
  const options = await appToolOptions(cwd);
  const externalTools = selection.tools.filter(
    (id) =>
      !options.some(
        (option) =>
          itemAddress(option.value, "tool") === itemAddress(id, "tool")
      )
  );
  options.push(...externalTools.map((value) => ({ label: value, value })));
  const selected = await chooseMany(
    "Which ChatJS tools would you like to enable?",
    options,
    options
      .filter((option) =>
        selection.tools.some(
          (id) => itemAddress(option.value, "tool") === itemAddress(id, "tool")
        )
      )
      .map((option) => option.value)
  );
  if (selected !== undefined) {
    selection.tools = selected;
  }
};

const editDefaultTools = async (
  selection: InstallationSelection
): Promise<void> => {
  const options = eveDefaultToolIds.map((id) => ({
    value: id,
    label: id.slice("tool/".length).replaceAll("_", " "),
  }));
  const selected = await chooseMany(
    "Which default EVE tools would you like to enable?",
    options,
    [...enabledEveDefaultTools(selection.agent)]
  );
  if (selected === undefined) {
    return;
  }
  selection.agent = {
    ...(selection.agent ?? defaultAgentConfiguration),
    defaultTools: true,
    disabledDefaultTools: eveDefaultToolIds.filter(
      (id) => !selected.includes(id)
    ),
  };
};

export const editExternalMedia = async (
  selection: InstallationSelection,
  cwd: string,
  kind?: MediaKind
): Promise<boolean> => {
  let mediaKind: MediaKind;
  let source: string | undefined;
  for (;;) {
    /* eslint-disable no-await-in-loop -- Esc from the address returns to the media picker. */
    const choice =
      kind ??
      (await choose("Which media tool would you like to use?", [
        { value: "image", label: createCatalog.imageGenerationTool.label },
        { value: "video", label: createCatalog.videoGenerationTool.label },
        back,
      ]));
    if (choice !== "image" && choice !== "video") {
      return false;
    }
    mediaKind = choice;
    source = await promptValue(
      `Enter an external ${mediaKind} generation tool registry address`
    );
    if (source !== undefined) {
      break;
    }
    if (kind !== undefined) {
      return false;
    }
    /* eslint-enable no-await-in-loop */
  }
  const address = await externalMedia(cwd, mediaKind, source);
  const existing = await Promise.all(
    selection.tools.map(async (tool) => {
      const item = await readItem(itemAddress(tool, "tool"), cwd);
      const definition = toolDefinitionSchema.parse(item.meta?.chatjs);
      return definition.slot === mediaSlots[mediaKind] ? undefined : tool;
    })
  );
  selection.tools = [...existing.filter((tool) => tool !== undefined), address];
  return true;
};

const loadEveCatalog = async () => {
  const items = await createCatalog.eveItem.choices.load();
  return items.filter(
    (item) =>
      !eveDefaultToolIds.some((id) => id === item.id) &&
      eveCompositionIssue(item.id) === undefined
  );
};

const editEveCategory = async (
  selection: InstallationSelection,
  category: string,
  items: Awaited<ReturnType<typeof loadEveCatalog>>,
  label: string
): Promise<void> => {
  const options = items
    .filter((item) =>
      category === "other"
        ? !Object.hasOwn(eveCategories, item.category)
        : item.category === category
    )
    .map((item) => ({
      value: item.id,
      label: item.title,
      hint: item.description,
    }));
  if (!options.length) {
    log.info(
      `No catalog entries for ${label}. You can add a capability by address.`
    );
    return;
  }
  const current = selection[createCatalog.eveItem.target] ?? [];
  const selected = await chooseMany(
    label,
    options,
    current.filter((id) => options.some((option) => option.value === id))
  );
  if (selected === undefined) {
    return;
  }
  selection[createCatalog.eveItem.target] = [
    ...current.filter((id) => !options.some((option) => option.value === id)),
    ...selected,
  ];
};

const editEveAddresses = async (
  selection: InstallationSelection
): Promise<void> => {
  for (;;) {
    /* eslint-disable no-await-in-loop -- Reopen capability actions after a form is submitted or cancelled. */
    const current = selection[createCatalog.eveItem.target] ?? [];
    const action = await choose("EVE capabilities by address", [
      { value: "add", label: "Add a capability" },
      ...(current.length
        ? [{ value: "remove", label: "Review selected capabilities" }]
        : []),
      back,
    ]);
    if (action === back.value) {
      return;
    }
    if (action === "add") {
      const id = await promptValue(
        "Enter an EVE item ID, @skills address or public HTTPS item URL",
        undefined,
        (value) => {
          const parsed = createCatalog.eveItem.choices.parseId.safeParse(
            value.trim()
          );
          if (!parsed.success) {
            return parsed.error.issues[0]?.message;
          }
          if (eveDefaultToolIds.some((tool) => tool === parsed.data)) {
            return "Use Default EVE tools to configure this tool.";
          }
          return eveCompositionIssue(parsed.data);
        }
      );
      if (id !== undefined) {
        const namespace = id.startsWith("@") ? id.split("/")[0] : undefined;
        if (
          namespace !== undefined &&
          namespace !== "@chatjs" &&
          namespace !== "@skills" &&
          selection.eveRegistries?.[namespace] === undefined
        ) {
          const template = await promptValue(
            `Enter the registry URL template for ${namespace}`,
            undefined,
            (value) => {
              const parsed = eveRegistriesSchema.safeParse({
                [namespace]: value.trim(),
              });
              return parsed.success
                ? undefined
                : parsed.error.issues[0]?.message;
            }
          );
          if (template === undefined) {
            continue;
          }
          selection.eveRegistries = {
            ...selection.eveRegistries,
            [namespace]: template,
          };
        }
        selection[createCatalog.eveItem.target] = [
          ...new Set([...(selection[createCatalog.eveItem.target] ?? []), id]),
        ];
      }
    }
    if (action === "remove") {
      const selected = await chooseMany(
        "Keep selected capabilities",
        current.map((id) => ({ value: id, label: id })),
        current
      );
      if (selected !== undefined) {
        selection[createCatalog.eveItem.target] = selected;
      }
    }
    /* eslint-enable no-await-in-loop */
  }
};

const editAgentTools = async (
  selection: InstallationSelection,
  cwd: string,
  getCatalog: typeof loadEveCatalog
): Promise<void> => {
  for (;;) {
    /* eslint-disable no-await-in-loop -- Tools returns here after each edit. */
    const action = await choose("Tools", [
      { value: "app", label: createCatalog.tool.label },
      { value: "default", label: createCatalog.disabledDefaultTool.label },
      { value: "eve", label: "More EVE tools" },
      { value: "media", label: "External media tool" },
      back,
    ]);
    if (action === back.value) {
      return;
    }
    if (action === "app") {
      await editAppTools(selection, cwd);
    }
    if (action === "default") {
      await editDefaultTools(selection);
    }
    if (action === "media") {
      await editExternalMedia(selection, cwd);
    }
    if (action === "eve") {
      await editEveCategory(
        selection,
        "tool",
        await getCatalog(),
        eveCategories.tool
      );
    }
    /* eslint-enable no-await-in-loop */
  }
};

export const editAgent = async (
  selection: InstallationSelection,
  cwd: string
): Promise<void> => {
  const categories = [
    ...Object.entries(eveCategories).map(([value, label]) => ({
      value,
      label,
    })),
    { value: "other", label: "Other EVE capabilities" },
  ];
  let loaded: Awaited<ReturnType<typeof loadEveCatalog>> | undefined;
  const getCatalog = async () => {
    loaded ??= await loadEveCatalog();
    return loaded;
  };
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- Agent can be edited in any order.
    const section = await choose("What would you like to configure in Agent?", [
      ...categories,
      { value: "sandbox", label: createCatalog.sandboxProvider.label },
      { value: "address", label: "Manage capabilities by address" },
      back,
    ]);
    if (section === back.value) {
      return;
    }
    /* eslint-disable no-await-in-loop -- Each selection edits the current Agent configuration. */
    if (section === "sandbox") {
      await editSandbox(selection, cwd);
    } else if (section === "address") {
      await editEveAddresses(selection);
    } else if (section === "tool") {
      await editAgentTools(selection, cwd, getCatalog);
    } else {
      const category = categories.find(({ value }) => value === section);
      if (category) {
        await editEveCategory(
          selection,
          section,
          await getCatalog(),
          category.label
        );
      }
    }
    /* eslint-enable no-await-in-loop */
  }
};
