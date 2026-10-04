import { readFile } from "node:fs/promises";
import path from "node:path";

import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { installationSelectionSchema } from "../../../registry/installation";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { InstallationSelection } from "../../../registry/installation";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  featureDefinitionSchema,
  featureIdSchema,
  toolDefinitionSchema,
  storageDefinitionSchema,
} from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type {
  FeatureDefinition,
  ToolDefinition,
} from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { itemAddress, readItem } from "../registry/shadcn";
/* oxlint-enable import/no-relative-parent-imports */
import { preflight } from "./preflight";
import { readProviderId } from "./provider-config";
import { readInstalledTools, validateToolInstallation } from "./sync-tools";

const validateRequestedKind = (
  source: string,
  kind: string | undefined,
  actual: unknown
): void => {
  if (typeof kind === "string" && kind !== "" && kind !== actual) {
    throw new Error(
      `Selected ${kind} item has incompatible ChatJS metadata: ${source}`
    );
  }
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
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
  const selectProvider = (definition: { kind: string; id: string }): void => {
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
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
    validateRequestedKind(source, kind, item.meta?.chatjs?.kind);
    if (sources.has(source)) {
      return;
    }
    sources.add(source);
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
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
      (item.registryDependencies ?? []).map((dependency): Promise<void> =>
        visit(dependency)
      )
    );
  };
  await Promise.all([
    ...selection.tools.map((source): Promise<void> =>
      visit(itemAddress(source, "tool"))
    ),
    ...selection.features.map((source): Promise<void> =>
      visit(itemAddress(source, "tool"), "feature")
    ),
    ...(typeof selection.gateway === "string" && selection.gateway !== ""
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
  const replacements = installed.flatMap((previous) => {
    const next = [...expected.values()].find(
      (item) =>
        item.id !== previous.id &&
        // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- This is a logical OR of independent conditions; false must continue to the next condition rather than short-circuit as with nullish coalescing.
        ((item.slot && item.slot === previous.slot) ||
          (item.documentKind && item.documentKind === previous.documentKind))
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
  });
  const target = () => [
    ...new Map([
      ...installed
        .filter(
          (item): boolean =>
            !replacements.some(
              ({ previous }): boolean => previous.id === item.id
            )
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
      definitions.some((item): boolean => item.requiresTools.includes(slot)) &&
      !definitions.some((item): boolean => item.slot === slot)
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
      feature.requiresFeatures?.filter((id): boolean => !featureIds.has(id)) ??
      [];
    if (missing.length > 0) {
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable eslint/max-statements */
