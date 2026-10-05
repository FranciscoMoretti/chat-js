// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { readFile } from "node:fs/promises";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { GatewayDefinition } from "@chat-js/gateways/definition";
/* oxlint-enable sort-imports */
import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { itemAddress, readItem } from "#cli/registry/shadcn";
/* oxlint-enable sort-imports */

// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import type { InstallationSelection } from "../../../registry/installation";
// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { installationSelectionSchema } from "../../../registry/installation";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  FeatureDefinition,
  ToolDefinition,
  // oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
} from "../../../registry/metadata";
/* oxlint-enable sort-imports */
import {
  featureDefinitionSchema,
  featureIdSchema,
  storageDefinitionSchema,
  toolDefinitionSchema,
  // oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
} from "../../../registry/metadata";
import {
  registryMetadataKind,
  validateCodeExecutionRequirements,
  validateProviderRequirements,
  validateRequestedKind,
} from "./installation-requirements";
import { preflight } from "./preflight";
import { readProviderId } from "./provider-config";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { readInstalledTools, validateToolInstallation } from "./sync-tools";
/* oxlint-enable sort-imports */

type ReadonlyNative<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNative<Value[Key]> }
    : Value;

const EMPTY_DEPENDENCY_COUNT = 0;

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
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
  // oxlint-disable-next-line eslint/init-declarations -- The optional gateway is assigned only when the selected registry graph contains one.
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
        async (dependency): Promise<void> => await visit(dependency)
      )
    );
  };
  await Promise.all([
    ...selection.tools.map(
      async (source): Promise<void> => await visit(itemAddress(source, "tool"))
    ),
    ...selection.features.map(
      async (source): Promise<void> =>
        await visit(itemAddress(source, "tool"), "feature")
    ),
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The public plan returns this original mutable installed descriptor in replacements.
    (previous: ToolDefinition) => {
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
              }: ReadonlyNative<{ previous: ToolDefinition }>): boolean =>
                previous.id === item.id
            )
        )
        .map(
          // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The target preserves mutable descriptors whose environment options are returned by the public plan.
          (item: ToolDefinition) => [item.id, item] as const
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
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each provider is resolved before validating the final installation.
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
    ...installedFeatures.flat().map(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve the mutable descriptor environment options returned by the public plan.
      (feature: FeatureDefinition) => [feature.id, feature] as const
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
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- These existing mutable environment options are returned as the public plan output.
        (tool: ToolDefinition) => tool.envRequirements
      ),
      ...[...targetFeatures.values()].flatMap(
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- These existing mutable environment options are returned as the public plan output.
        (feature: FeatureDefinition) => feature.envRequirements ?? []
      ),
    ].flatMap(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Return original mutable environment option objects without narrowing the public result.
      (requirement: ToolDefinition["envRequirements"][number]) =>
        requirement.options.flat()
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
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Registry graph traversal, exclusive-provider validation, feature dependency checks, and the resolved installation snapshot share one memoized planning context. */
