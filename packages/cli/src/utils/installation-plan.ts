import { assertCurrentInstallationLayout } from "./installation-layout";
import { readInstalledPlugins } from "./installed-plugins";
import { sandboxDefinitionSchema } from "@chat-js/sandboxes/definition";
import type {
  PluginDefinition,
  ToolDefinition,
} from "../../../registry/metadata";

import type { GatewayDefinition } from "@chat-js/gateways/definition";

import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";

import { itemAddress, readItem } from "#cli/registry/shadcn";

import type { InstallationSelection } from "../../../registry/installation";
import { installationSelectionSchema } from "../../../registry/installation";

import {
  pluginDefinitionSchema,
  storageDefinitionSchema,
  toolDefinitionSchema,
} from "../../../registry/metadata";
import {
  registryMetadataKind,
  validateCodeExecutionRequirements,
  validateProviderRequirements,
  validateRequestedKind,
} from "./installation-requirements";
import { readProviderId } from "./provider-config";

import { readInstalledTools, validateToolInstallation } from "./sync-tools";

type ReadonlyNative<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNative<Value[Key]> }
    : Value;

const EMPTY_DEPENDENCY_COUNT = 0;

/**
 * Resolve the complete target installation before any source files are written.
 * @param {string} cwd Project directory used for provider, plugin and tool preflight.
 * @param {ReadonlyNative<InstallationSelection>} input Requested registry selections validated before dependency resolution.
 * @param {{ readonly fresh?: boolean; readonly replace?: boolean; readonly documents?: boolean; }} options Whether this is a fresh installation and replacements are permitted.
 * @returns {ReturnType<typeof planInstallation>} Resolved items, validated selections, target changes and registry sources.
 */
export const planInstallation = async (
  cwd: string,
  input: ReadonlyNative<InstallationSelection>,
  options: {
    readonly fresh?: boolean;
    readonly replace?: boolean;
    readonly documents?: boolean;
  } = {}
) => {
  if (options.fresh !== true) {
    await assertCurrentInstallationLayout(cwd);
  }
  const selection = installationSelectionSchema.parse(input);
  const installed = options.fresh === true ? [] : await readInstalledTools(cwd);
  const expected = new Map<string, ToolDefinition>();
  const sources = new Set<string>();
  const items = new Map<string, ReturnType<typeof readItem>>();
  const plugins = new Map<string, PluginDefinition>();
  const providers = new Map<string, string>();
  let gateway: GatewayDefinition | undefined;
  let sandboxProviderSource: string | undefined;
  const selectProvider = (definition: {
    readonly kind: string;
    readonly id: string;
  }): void => {
    const previous = providers.get(definition.kind);
    if (
      typeof previous === "string" &&
      previous !== "" &&
      previous !== definition.id
    ) {
      throw new Error(
        `Only one ${definition.kind} provider can be installed: ${previous}, ${definition.id}.`
      );
    }
    providers.set(definition.kind, definition.id);
  };
  const visit = async (source: string, kind?: string): Promise<void> => {
    const pending = items.get(source) ?? readItem(source, cwd);
    items.set(source, pending);
    const item = await pending;
    const metadata: unknown = item.meta?.chatjs;
    validateRequestedKind(source, kind, registryMetadataKind(metadata));
    if (sources.has(source)) {
      return;
    }
    sources.add(source);
    switch (registryMetadataKind(metadata)) {
      case "plugin": {
        const definition = pluginDefinitionSchema.parse(metadata);
        const previous = plugins.get(definition.id);
        if (
          previous &&
          JSON.stringify(previous) !== JSON.stringify(definition)
        ) {
          throw new Error(
            `Conflicting requested descriptors for ${definition.id}.`
          );
        }
        plugins.set(definition.id, definition);
        break;
      }
      case "tool": {
        const definition = toolDefinitionSchema.parse(metadata);
        validateCodeExecutionRequirements(definition);
        const previous = expected.get(definition.id);
        if (
          previous &&
          JSON.stringify(previous) !== JSON.stringify(definition)
        ) {
          throw new Error(
            `Conflicting requested descriptors for ${definition.id}.`
          );
        }
        expected.set(definition.id, definition);
        break;
      }
      case "gateway": {
        gateway = gatewayDefinitionSchema.parse(metadata);
        selectProvider(gateway);
        break;
      }
      case "sandbox": {
        selectProvider(sandboxDefinitionSchema.parse(metadata));
        sandboxProviderSource = item.files?.find(
          (file) => file.target === "~/chatjs/providers/sandbox/provider.ts"
        )?.content;
        break;
      }
      case "storage": {
        selectProvider(storageDefinitionSchema.parse(metadata));
        break;
      }
      default: {
        break;
      }
    }
    await Promise.all(
      (item.registryDependencies ?? []).map(
        async (dependency): Promise<void> => {
          await visit(dependency);
        }
      )
    );
  };
  await Promise.all([
    ...selection.tools.map(async (source): Promise<void> => {
      await visit(itemAddress(source, "tool"));
    }),
    ...selection.plugins.map(async (source): Promise<void> => {
      await visit(itemAddress(source, "tool"), "plugin");
    }),
    ...(typeof selection.gateway === "string" && selection.gateway !== ""
      ? [visit(itemAddress(selection.gateway, "gateway"), "gateway")]
      : []),
    ...(typeof selection.sandbox === "string" && selection.sandbox !== ""
      ? [visit(itemAddress(selection.sandbox, "sandbox"), "sandbox")]
      : []),
    ...(selection.storage
      ? [visit(itemAddress(selection.storage.source, "storage"), "storage")]
      : []),
  ]);
  const providerChanges = await Promise.all(
    [...providers].map(async ([kind, next]: readonly [string, string]) => {
      if (kind !== "gateway" && kind !== "storage" && kind !== "sandbox") {
        throw new Error("Invalid exclusive provider kind.");
      }
      const previous =
        options.fresh === true ? undefined : await readProviderId(cwd, kind);
      if (
        typeof previous === "string" &&
        previous !== "" &&
        previous !== next &&
        !(options.replace === true)
      ) {
        throw new Error(
          `Replace ${kind} provider ${previous} with ${next} explicitly using --replace.`
        );
      }
      return { kind, next, previous };
    })
  );
  const replacements = installed.flatMap(
    (previous: ReadonlyNative<ToolDefinition>) => {
      const next = [...expected.values()].find(
        (item: ReadonlyNative<ToolDefinition>) =>
          item.id !== previous.id &&
          ((typeof item.slot === "string" && item.slot === previous.slot) ||
            (typeof item.documentKind === "string" &&
              item.documentKind === previous.documentKind))
      );
      if (!next) {
        return [];
      }
      if (!(options.fresh === true) && !(options.replace === true)) {
        throw new Error(
          `Only one ${previous.slot ?? previous.documentKind} provider can be installed. Replace ${previous.id} with ${next.id} explicitly using --replace.`
        );
      }
      return [{ next, previous }];
    }
  );
  const target = () => [
    ...new Map([
      ...installed
        .filter(
          (item: ReadonlyNative<ToolDefinition>): boolean =>
            !replacements.some(
              ({
                previous,
              }: ReadonlyNative<{
                previous: ReadonlyNative<ToolDefinition>;
              }>): boolean => previous.id === item.id
            )
        )
        .map(
          (item: ReadonlyNative<ToolDefinition>) => [item.id, item] as const
        ),
      ...expected.entries(),
    ]).values(),
  ];
  // ChatJS's two selectable execution dependencies have concrete default providers.
  for (const [slot, provider] of [
    ["codeExecution", "code-execution"],
    ["webSearch", "tavily-search"],
  ] as const) {
    const definitions = target();
    if (
      definitions.some((item: ReadonlyNative<ToolDefinition>): boolean =>
        item.requiresTools.includes(slot)
      ) &&
      !definitions.some(
        (item: ReadonlyNative<ToolDefinition>): boolean => item.slot === slot
      )
    ) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- visit mutates the expected dependency graph; resolve the first default provider before target() decides whether the next slot is still missing.
      await visit(itemAddress(provider, "tool"));
    }
  }
  if (
    options.documents === false &&
    target().some(
      (tool: ReadonlyNative<ToolDefinition>) =>
        typeof tool.documentKind === "string"
    )
  ) {
    throw new Error(
      "The selected tools require documents. Omit --no-documents or omit document-dependent tools."
    );
  }
  validateToolInstallation(target());
  const installedPlugins =
    options.fresh === true
      ? []
      : await readInstalledPlugins(cwd, new Set(plugins.keys()));
  const targetPlugins = new Map([
    ...installedPlugins
      .flat()
      .map(
        (plugin: ReadonlyNative<PluginDefinition>) =>
          [plugin.id, plugin] as const
      ),
    ...plugins.entries(),
  ]);
  const pluginIds = new Set(targetPlugins.keys());
  for (const plugin of targetPlugins.values()) {
    const missing =
      plugin.requiresPlugins?.filter((id): boolean => !pluginIds.has(id)) ?? [];
    if (missing.length > EMPTY_DEPENDENCY_COUNT) {
      throw new Error(
        `${plugin.id} requires installed plugins: ${missing.join(", ")}`
      );
    }
  }
  await validateProviderRequirements(cwd, {
    plugins: [...targetPlugins.values()],
    gateway,
    storage: providers.get("storage"),
    sandbox: providers.get("sandbox"),
    sandboxProviderSource,
    tools: target(),
  });
  return {
    environmentVariables: [
      ...target().flatMap(
        (tool: ReadonlyNative<ToolDefinition>) => tool.envRequirements
      ),
      ...[...targetPlugins.values()].flatMap(
        (plugin: ReadonlyNative<PluginDefinition>) =>
          plugin.envRequirements ?? []
      ),
    ].flatMap(
      (
        requirement: ReadonlyNative<ToolDefinition["envRequirements"][number]>
      ) => requirement.options.flat()
    ),
    expected: [...expected.values()],
    plugins: [...plugins.values()],
    items: await Promise.all(items.values()),
    providerChanges,
    replacements,
    selection,
    sources: [...items.keys()],
  };
};
