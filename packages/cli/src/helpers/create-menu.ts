import { decodePreset } from "shadcn/preset";
import { log } from "@clack/prompts";
import type { Option } from "@clack/prompts";
import {
  back,
  choose,
  chooseMany,
  promptAuth,
  promptValue,
} from "#cli/helpers/prompts";
import {
  editAgent,
  editExternalMedia,
  externalMedia,
} from "#cli/helpers/create-agent";
import {
  editGateway,
  editSandbox,
  editStorage,
  gatewayOptions,
  sandboxOptions,
  storageOptions,
} from "#cli/helpers/create-providers";
import { listRegistryItems } from "#cli/registry/shadcn";
import { registryItems } from "../../../registry/registry-items";
import { installationCatalog } from "../../../registry/installation-catalog";

import type { InstallationSelection } from "../../../registry/installation";
import { groupAppPlugins } from "../../../registry/create-groups";
import {
  defaultAgentConfiguration,
  enabledEveDefaultTools,
} from "../../../registry/agent-configuration";
import { ProviderRequirementError } from "#cli/utils/installation-requirements";

import {
  authProviderLabels,
  defaultAuthProviders,
  installationSelectionSchema,
} from "../../../registry/installation";
import {
  createCatalog,
  registryChoices,
  setupMenu,
  createSections,
  createFieldKeys,
} from "../../../registry/create-catalog";
import type { CreateSelectionFlags } from "./selection-options";

interface Draft {
  preset?: string;
  selection: InstallationSelection;
}

export const createSelectionFromFlags = async (
  cwd: string,
  flags: CreateSelectionFlags
): Promise<InstallationSelection> => {
  const media = [
    ["image", flags.imageGenerationTool],
    ["video", flags.videoGenerationTool],
  ] as const;
  const tools = await Promise.all(
    media.flatMap(([kind, source]) =>
      source === undefined ? [] : [externalMedia(cwd, kind, source)]
    )
  );
  const selected: Partial<InstallationSelection> = {};
  const plugins = new Set(flags.plugin);
  for (const key of createFieldKeys) {
    const field = createCatalog[key];
    const value = flags[key];
    if ("target" in field && value !== undefined) {
      Object.assign(selected, { [field.target]: value });
    }
    if ("pluginId" in field) {
      const enabled = value;
      if (enabled === true) {
        plugins.add(field.pluginId);
      }
      if (enabled === false) {
        plugins.delete(field.pluginId);
      }
    }
  }
  return installationSelectionSchema.parse({
    ...selected,
    plugins: [...plugins],
    tools: [...new Set([...(selected.tools ?? []), ...tools])],
    agent:
      flags.disabledDefaultTool === undefined
        ? selected.agent
        : {
            ...(selected.agent ?? defaultAgentConfiguration),
            disabledDefaultTools: [
              ...new Set([
                ...(flags.agentConfig?.disabledDefaultTools ?? []),
                ...flags.disabledDefaultTool,
              ]),
            ],
          },
    gateway: selected.gateway ?? createCatalog.gateway.defaultValue,
    sandbox: selected.sandbox ?? createCatalog.sandboxProvider.defaultValue,
    storage: {
      source:
        flags.storageProvider ?? createCatalog.storageProvider.defaultValue,
      options: flags.storageConfig ?? {},
    },
  });
};

const catalog = installationCatalog(registryItems);
const syncSelection = (
  current: readonly string[],
  options: readonly Option<string>[],
  next: readonly string[]
) => [
  ...current.filter((id) => !options.some((option) => option.value === id)),
  ...next,
];

const editAppearance = async (draft: Draft): Promise<void> => {
  for (;;) {
    /* eslint-disable no-await-in-loop -- Esc from the preset input returns to Appearance. */
    const action = await choose(
      "Which appearance preset would you like to use?",
      [
        { value: "keep", label: "Keep current preset" },
        { value: "preset", label: "Enter a shadcn preset code" },
        back,
      ]
    );
    if (action !== "preset") {
      return;
    }
    const preset = await promptValue(
      "Enter your shadcn preset code",
      draft.preset,
      (code) =>
        decodePreset(code.trim())
          ? undefined
          : "Enter a valid shadcn preset code."
    );
    if (preset !== undefined) {
      draft.preset = preset;
      return;
    }
    /* eslint-enable no-await-in-loop */
  }
};

const editPlugins = async (draft: Draft, cwd: string): Promise<void> => {
  const items = await listRegistryItems(cwd);
  const groups = groupAppPlugins(installationCatalog(items));
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- Each menu visit edits the current selection.
    const section = await choose(
      "Which plugin group would you like to configure?",
      [...groups.map(({ title }) => ({ value: title, label: title })), back]
    );
    if (section === back.value) {
      return;
    }
    const group = groups.find(({ title }) => title === section);
    const options = registryChoices(
      group?.items ?? [],
      createCatalog.plugin.source
    );
    // eslint-disable-next-line no-await-in-loop -- Wait for the user before returning to Plugins.
    const selected = await chooseMany(
      section,
      options,
      draft.selection.plugins.filter((id) =>
        options.some((option) => option.value === id)
      )
    );
    if (selected !== undefined) {
      draft.selection.plugins = syncSelection(
        draft.selection.plugins,
        options,
        selected
      );
    }
  }
};

const editSetup = async (draft: Draft, cwd: string): Promise<void> => {
  for (;;) {
    /* eslint-disable no-await-in-loop -- Setup returns here after each edit. */
    const section = await choose("What would you like to configure in Setup?", [
      ...setupMenu,
      back,
    ]);
    if (section === back.value) {
      return;
    }
    if (section === "gateway") {
      await editGateway(draft.selection, cwd);
    }
    if (section === "auth") {
      draft.selection.auth = await promptAuth(draft.selection.auth, true);
    }
    if (section === "infrastructure") {
      while (
        (await choose("Infrastructure", [
          { value: "storage", label: createCatalog.storageProvider.label },
          back,
        ])) === "storage"
      ) {
        await editStorage(draft.selection, cwd);
      }
    }
    if (section === "platforms") {
      const options = [
        {
          value: createCatalog.electron.pluginId,
          label: createCatalog.electron.label,
        },
      ];
      const selected = await chooseMany(
        "Platforms (web is included)",
        options,
        draft.selection.plugins.filter((id) => id === "desktop")
      );
      if (selected !== undefined) {
        draft.selection.plugins = syncSelection(
          draft.selection.plugins,
          options,
          selected
        );
      }
    }
    /* eslint-enable no-await-in-loop */
  }
};

const requirementActions = {
  gateway: { label: "Go to Models & Gateways", edit: editGateway },
  storage: { label: "Go to File storage", edit: editStorage },
  sandbox: { label: "Go to Sandbox", edit: editSandbox },
};

const reviewRequirement = async (
  error: ProviderRequirementError,
  draft: Draft,
  cwd: string
): Promise<void> => {
  log.warn(error.message);
  const { label, edit } = requirementActions[error.provider];
  for (;;) {
    /* eslint-disable no-await-in-loop -- Back from a provider picker returns to the requirement. */
    const action = await choose("Complete setup before creating the app", [
      { value: "configure", label },
      ...(error.provider === "gateway"
        ? [{ value: "media", label: "Use an external media tool" }]
        : []),
      { ...back, label: "Edit selections" },
    ]);
    if (action === back.value) {
      return;
    }
    const updated =
      action === "configure"
        ? await edit(draft.selection, cwd)
        : await editExternalMedia(draft.selection, cwd, error.media);
    if (updated) {
      return;
    }
    /* eslint-enable no-await-in-loop */
  }
};

const catalogTitles = (ids: readonly string[]): string =>
  ids
    .map(
      (id) =>
        catalog.find(
          (item) => item.definition?.id === id || `@chatjs/${item.name}` === id
        )?.title ?? id
    )
    .join(", ");

const summarize = (draft: Draft, shadcnArgs: readonly string[]): void => {
  const { gateway, plugins, sandbox, storage, tools, eve } = draft.selection;
  const gatewayName =
    gatewayOptions.find(({ value }) => value === gateway)?.label ?? gateway;
  const storageName =
    storageOptions.find(({ value }) => value === storage?.source)?.label ??
    storage?.source;
  const sandboxName =
    sandboxOptions.find(({ value }) => value === sandbox)?.label ?? sandbox;
  const auth = (draft.selection.auth ?? defaultAuthProviders).map(
    (provider) => authProviderLabels[provider]
  );
  log.info(
    [
      `Appearance  ${draft.preset ?? (shadcnArgs.length ? "Supplied shadcn options" : "Rhea")}`,
      `Plugins     ${catalogTitles(plugins.filter((id) => id !== "desktop")) || "None selected"}`,
      `Agent       ${enabledEveDefaultTools(draft.selection.agent).length} default tools · ${sandboxName}${tools.length > 0 || (eve?.length ?? 0) > 0 ? ` · ${catalogTitles([...tools, ...(eve ?? [])])}` : ""}`,
      `Setup       ${gatewayName} · ${storageName} · ${plugins.includes("desktop") ? "Web and Electron" : "Web"} · ${auth.join(", ")}`,
    ].join("\n")
  );
};

export const promptCreateMenu = async <Setup>(
  project: Readonly<{ projectName: string; targetDir: string }>,
  selection: InstallationSelection,
  shadcnArgs: readonly string[],
  prepare: (draft: Readonly<Draft>) => Promise<Setup>
): Promise<{ setup: Setup; appearance: readonly string[] }> => {
  const draft: Draft = { selection };
  const cwd = project.targetDir;
  for (;;) {
    /* eslint-disable no-await-in-loop -- Menu navigation is sequential and review uses the latest edits. */
    const action = await choose(`Create ${project.projectName}`, [
      { value: "review", label: "Create with current settings" },
      ...createSections,
    ]);
    try {
      if (action === "appearance") {
        await editAppearance(draft);
      }
      if (action === "plugins") {
        await editPlugins(draft, cwd);
      }
      if (action === "agent") {
        await editAgent(draft.selection, cwd);
      }
      if (action === "setup") {
        await editSetup(draft, cwd);
      }
      if (action === "review") {
        const setup = await prepare(draft);
        summarize(draft, shadcnArgs);
        const answer = await choose(`Ready to create ${project.projectName}?`, [
          { value: "create", label: "Create app" },
          { ...back, label: "Edit selections" },
        ]);
        if (answer === "create") {
          return {
            setup,
            appearance:
              draft.preset === undefined
                ? shadcnArgs
                : [...shadcnArgs, "--preset", draft.preset],
          };
        }
      }
    } catch (error) {
      if (error instanceof ProviderRequirementError) {
        try {
          await reviewRequirement(error, draft, cwd);
        } catch (editError) {
          log.error(
            editError instanceof Error ? editError.message : String(editError)
          );
        }
      } else {
        log.error(error instanceof Error ? error.message : String(error));
      }
    }
    /* eslint-enable no-await-in-loop */
  }
};
