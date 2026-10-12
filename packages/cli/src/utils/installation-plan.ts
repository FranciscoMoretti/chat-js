import type {
  FeatureDefinition,
  ToolDefinition,
} from "../../../registry/metadata";

import type { GatewayDefinition } from "@chat-js/gateways/definition";

import path from "node:path";
import { readFile } from "node:fs/promises";

import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";

import { itemAddress, readItem } from "#cli/registry/shadcn";

import type { InstallationSelection } from "../../../registry/installation";
import { installationSelectionSchema } from "../../../registry/installation";

import {
  featureDefinitionSchema,
  featureIdSchema,
  storageDefinitionSchema,
  toolDefinitionSchema,
} from "../../../registry/metadata";
import {
  registryMetadataKind,
  validateCodeExecutionRequirements,
  validateProviderRequirements,
  validateRequestedKind,
} from "./installation-requirements";
import { preflight } from "./preflight";
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
 * @param {string} cwd Project directory used for provider, feature and tool preflight.
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
  const selection = installationSelectionSchema.parse(input);
  const installed = options.fresh === true ? [] : await readInstalledTools(cwd);
  const expected = new Map<string, ToolDefinition>();
  const sources = new Set<string>();
  const items = new Map<string, ReturnType<typeof readItem>>();
  const features = new Map<string, FeatureDefinition>();
  const providers = new Map<string, string>();
  let gateway: GatewayDefinition | undefined;
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
      case "feature": {
        const definition = featureDefinitionSchema.parse(metadata);
        const previous = features.get(definition.id);
        if (
          previous &&
          JSON.stringify(previous) !== JSON.stringify(definition)
        ) {
          throw new Error(
            `Conflicting requested descriptors for ${definition.id}.`
          );
        }
        features.set(definition.id, definition);
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
    ...selection.features.map(async (source): Promise<void> => {
      await visit(itemAddress(source, "tool"), "feature");
    }),
    ...(typeof selection.gateway === "string" && selection.gateway !== ""
      ? [visit(itemAddress(selection.gateway, "gateway"), "gateway")]
      : []),
    ...(selection.storage
      ? [visit(itemAddress(selection.storage.source, "storage"), "storage")]
      : []),
  ]);
  const providerChanges = await Promise.all(
    [...providers].map(async ([kind, next]: readonly [string, string]) => {
      if (kind !== "gateway" && kind !== "storage") {
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
    ["codeExecution", "vercel-code-execution"],
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
  await validateToolInstallation(cwd, target());
  const installedFeatures =
    options.fresh === true
      ? []
      : await Promise.all(
          featureIdSchema.options.map(async (id) => {
            const descriptor = `features/${id}/chatjs.json`;
            await preflight(cwd, [descriptor]);
            const content = await readFile(
              path.join(cwd, descriptor),
              "utf-8"
            ).catch((error: unknown) => {
              if (
                error instanceof Error &&
                "code" in error &&
                error.code === "ENOENT"
              ) {
                return null;
              }
              throw error;
            });
            if (content === null) {
              return [];
            }
            const definition = featureDefinitionSchema.parse(
              JSON.parse(content)
            );
            if (definition.id !== id) {
              throw new Error(
                `Feature descriptor id must match its directory: ${id}`
              );
            }
            return [definition];
          })
        );
  const targetFeatures = new Map([
    ...installedFeatures
      .flat()
      .map(
        (feature: ReadonlyNative<FeatureDefinition>) =>
          [feature.id, feature] as const
      ),
    ...features.entries(),
  ]);
  const featureIds = new Set(targetFeatures.keys());
  for (const feature of targetFeatures.values()) {
    const missing =
      feature.requiresFeatures?.filter((id): boolean => !featureIds.has(id)) ??
      [];
    if (missing.length > EMPTY_DEPENDENCY_COUNT) {
      throw new Error(
        `${feature.id} requires installed features: ${missing.join(", ")}`
      );
    }
  }
  await validateProviderRequirements(cwd, {
    features: [...targetFeatures.values()],
    gateway,
    storage: providers.get("storage"),
    tools: target(),
  });
  return {
    environmentVariables: [
      ...target().flatMap(
        (tool: ReadonlyNative<ToolDefinition>) => tool.envRequirements
      ),
      ...[...targetFeatures.values()].flatMap(
        (feature: ReadonlyNative<FeatureDefinition>) =>
          feature.envRequirements ?? []
      ),
    ].flatMap(
      (
        requirement: ReadonlyNative<ToolDefinition["envRequirements"][number]>
      ) => requirement.options.flat()
    ),
    expected: [...expected.values()],
    features: [...features.values()],
    items: await Promise.all(items.values()),
    providerChanges,
    replacements,
    selection,
    sources: [...items.keys()],
  };
};
