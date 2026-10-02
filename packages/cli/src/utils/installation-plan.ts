import { readFile } from "node:fs/promises";
import path from "node:path";

import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";

import { installationSelectionSchema } from "../../../registry/installation";
import type { InstallationSelection } from "../../../registry/installation";
import {
  featureDefinitionSchema,
  featureIdSchema,
  toolDefinitionSchema,
  storageDefinitionSchema,
} from "../../../registry/metadata";
import type {
  FeatureDefinition,
  ToolDefinition,
} from "../../../registry/metadata";
import { itemAddress, readItem } from "../registry/shadcn";
import { preflight } from "./preflight";
import { readProviderId } from "./provider-config";
import { readInstalledTools, validateToolInstallation } from "./sync-tools";

const validateRequestedKind = (
  source: string,
  kind: string | undefined,
  actual: unknown
) => {
  if (kind && kind !== actual) {
    throw new Error(
      `Selected ${kind} item has incompatible ChatJS metadata: ${source}`
    );
  }
};

/** Resolve the complete target installation before any source files are written. */
export const planInstallation = async (
  cwd: string,
  input: InstallationSelection,
  options: { fresh?: boolean; replace?: boolean } = {}
) => {
  const selection = installationSelectionSchema.parse(input);
  const installed = await readInstalledTools(cwd);
  const expected = new Map<string, ToolDefinition>();
  const sources = new Set<string>();
  const items = new Map<string, ReturnType<typeof readItem>>();
  const features = new Map<string, FeatureDefinition>();
  const providers = new Map<string, string>();
  const selectProvider = (definition: { kind: string; id: string }) => {
    const previous = providers.get(definition.kind);
    if (previous && previous !== definition.id) {
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
    validateRequestedKind(source, kind, item.meta?.chatjs?.kind);
    if (sources.has(source)) {
      return;
    }
    sources.add(source);
    switch (item.meta?.chatjs?.kind) {
      case "feature": {
        const definition = featureDefinitionSchema.parse(item.meta.chatjs);
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
        const definition = toolDefinitionSchema.parse(item.meta.chatjs);
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
        selectProvider(gatewayDefinitionSchema.parse(item.meta.chatjs));
        break;
      }
      case "storage": {
        selectProvider(storageDefinitionSchema.parse(item.meta.chatjs));
        break;
      }
      default: {
        break;
      }
    }
    await Promise.all(
      (item.registryDependencies ?? []).map((dependency) => visit(dependency))
    );
  };
  await Promise.all([
    ...selection.tools.map((source) => visit(itemAddress(source, "tool"))),
    ...selection.features.map((source) =>
      visit(itemAddress(source, "tool"), "feature")
    ),
    ...(selection.gateway
      ? [visit(itemAddress(selection.gateway, "gateway"), "gateway")]
      : []),
    ...(selection.storage
      ? [visit(itemAddress(selection.storage.source, "storage"), "storage")]
      : []),
  ]);
  const providerChanges = await Promise.all(
    [...providers].map(async ([kind, next]) => {
      if (kind !== "gateway" && kind !== "storage") {
        throw new Error("Invalid exclusive provider kind.");
      }
      const previous = options.fresh
        ? undefined
        : await readProviderId(cwd, kind);
      if (previous && previous !== next && !options.replace) {
        throw new Error(
          `Replace ${kind} provider ${previous} with ${next} explicitly using --replace.`
        );
      }
      return { kind, next, previous };
    })
  );
  const replacements = installed.flatMap((previous) => {
    const next = [...expected.values()].find(
      (item) =>
        item.id !== previous.id &&
        ((item.slot && item.slot === previous.slot) ||
          (item.documentKind && item.documentKind === previous.documentKind))
    );
    if (!next) {
      return [];
    }
    if (!options.replace) {
      throw new Error(
        `Only one ${previous.slot ?? previous.documentKind} provider can be installed. Replace ${previous.id} with ${next.id} explicitly using --replace.`
      );
    }
    return [{ next, previous }];
  });
  const target = () => [
    ...new Map([
      ...installed
        .filter(
          (item) =>
            !replacements.some(({ previous }) => previous.id === item.id)
        )
        .map((item) => [item.id, item] as const),
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
      definitions.some((item) => item.requiresTools.includes(slot)) &&
      !definitions.some((item) => item.slot === slot)
    ) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each provider is resolved before validating the final installation.
      await visit(itemAddress(provider, "tool"));
    }
  }
  validateToolInstallation(cwd, target());
  const installedFeatures = await Promise.all(
    featureIdSchema.options.map(async (id) => {
      const descriptor = `features/${id}/chatjs.json`;
      await preflight(cwd, [descriptor]);
      const content = await readFile(path.join(cwd, descriptor), "utf-8").catch(
        (error: unknown) => {
          if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
          ) {
            return null;
          }
          throw error;
        }
      );
      if (content === null) {
        return [];
      }
      const definition = featureDefinitionSchema.parse(JSON.parse(content));
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
      .map((feature) => [feature.id, feature] as const),
    ...features.entries(),
  ]);
  const featureIds = new Set(targetFeatures.keys());
  for (const feature of targetFeatures.values()) {
    const missing =
      feature.requiresFeatures?.filter((id) => !featureIds.has(id)) ?? [];
    if (missing.length) {
      throw new Error(
        `${feature.id} requires installed features: ${missing.join(", ")}`
      );
    }
  }
  return {
    expected: [...expected.values()],
    features: [...features.values()],
    items: await Promise.all(items.values()),
    providerChanges,
    replacements,
    selection,
    sources: [...items.keys()],
  };
};
