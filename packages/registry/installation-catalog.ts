import { z } from "zod";
import type { RegistryItem } from "shadcn/schema";
import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
import { sandboxDefinitionSchema } from "@chat-js/sandboxes/definition";
import {
  pluginDefinitionSchema,
  storageDefinitionSchema,
  toolDefinitionSchema,
} from "./metadata";
import { installationSelectionSchema } from "./installation";
import type { InstallationSelection } from "./installation";

type Definition =
  | ReturnType<typeof pluginDefinitionSchema.parse>
  | ReturnType<typeof toolDefinitionSchema.parse>
  | ReturnType<typeof gatewayDefinitionSchema.parse>
  | ReturnType<typeof sandboxDefinitionSchema.parse>
  | ReturnType<typeof storageDefinitionSchema.parse>;
const parseDefinition = (input: unknown): Definition => {
  const { kind } = z
    .object({
      kind: z.enum(["plugin", "tool", "gateway", "sandbox", "storage"]),
    })
    .parse(input);
  switch (kind) {
    case "plugin": {
      return pluginDefinitionSchema.parse(input);
    }
    case "tool": {
      return toolDefinitionSchema.parse(input);
    }
    case "gateway": {
      return gatewayDefinitionSchema.parse(input);
    }
    case "sandbox": {
      return sandboxDefinitionSchema.parse(input);
    }
    case "storage": {
      return storageDefinitionSchema.parse(input);
    }
    default: {
      throw new Error("Unsupported installation metadata.");
    }
  }
};
export interface InstallationCatalogItem {
  name: string;
  title: string;
  description: string;
  dependencies: string[];
  definition?: Definition;
}

/** Metadata only: no component imports, source files, credentials or installer effects. */
export const installationCatalog = (
  items: readonly RegistryItem[]
): InstallationCatalogItem[] =>
  items.map((item) => ({
    name: item.name,
    title:
      item.title ??
      item.name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    description: item.description ?? "",
    dependencies: (item.registryDependencies ?? [])
      .filter((source) => source.startsWith("@chatjs/"))
      .map((source) => source.slice("@chatjs/".length)),
    definition:
      item.meta?.chatjs === undefined
        ? undefined
        : parseDefinition(item.meta.chatjs),
  }));

// Installation policy shared with the incremental CLI planner.
export const defaultToolProviders = {
  codeExecution: "code-execution",
  webSearch: "tavily-search",
} as const;

const mediaIssues = (
  definition: Extract<Definition, { kind: "tool" }>,
  gateway: Definition | undefined
): string[] => {
  const issues: string[] = [];
  for (const kind of definition.requiresGateway ?? []) {
    if (
      gateway?.kind !== "gateway" ||
      !gateway.capabilities[kind] ||
      (gateway.defaults.roles[kind]?.trim() ?? "") === ""
    ) {
      issues.push(
        `${definition.id} requires a gateway with ${kind} generation and a default model.`
      );
    }
  }
  return issues;
};

const providerIssues = (
  definitions: readonly Definition[],
  gateway: Definition | undefined,
  storage: Definition | undefined,
  sandbox: Definition | undefined
): string[] => {
  const issues: string[] = [];
  for (const definition of definitions) {
    if (definition.kind !== "plugin" && definition.kind !== "tool") {
      continue;
    }
    if (definition.requiresStorage && (!storage || storage.id === "memory")) {
      issues.push(`${definition.id} requires persistent storage.`);
    }
    if (
      definition.kind === "plugin" &&
      definition.requiresPersistentSandbox &&
      (sandbox?.kind !== "sandbox" || sandbox.capabilities.persistent !== true)
    ) {
      issues.push(
        `${definition.id} requires a persistent sandbox. Choose Vercel Sandbox.`
      );
    }
    if (definition.kind !== "tool") {
      continue;
    }
    if (definition.requiresSandbox && !sandbox) {
      issues.push(`${definition.id} requires a sandbox.`);
    }
    issues.push(...mediaIssues(definition, gateway));
  }
  return issues;
};

const toolIssues = (definitions: readonly Definition[]): string[] => {
  const issues: string[] = [];
  const occupied = new Map<string, string>();
  for (const definition of definitions) {
    if (definition.kind !== "tool") {
      continue;
    }
    for (const key of [definition.slot, definition.documentKind].filter(
      (value) => value !== undefined
    )) {
      const previous = occupied.get(key);
      if (previous !== undefined) {
        issues.push(
          `Choose only one ${key} provider: ${previous} or ${definition.id}.`
        );
      }
      occupied.set(key, definition.id);
    }
    for (const required of definition.requiresTools) {
      if (
        !definitions.some(
          (candidate) =>
            candidate.kind === "tool" &&
            (candidate.slot === required ||
              candidate.tools.some((tool) => tool.toolExport === required))
        )
      ) {
        issues.push(`${definition.id} requires tool ${required}.`);
      }
    }
  }
  return issues;
};
const storageIssues = (
  selection: Readonly<InstallationSelection>,
  storage: Definition | undefined
): string[] => {
  const issues: string[] = [];
  if (storage?.kind === "storage") {
    for (const key of storage.configKeys) {
      if (
        typeof selection.storage?.options[key] !== "string" ||
        !selection.storage.options[key].trim()
      ) {
        issues.push(`${storage.id} requires public configuration: ${key}.`);
      }
    }
    for (const key of Object.keys(selection.storage?.options ?? {})) {
      if (!storage.configKeys.includes(key)) {
        issues.push(
          `Unsupported public storage option: ${key}. Use environment variables for credentials.`
        );
      }
    }
  }
  return issues;
};

export const resolveInstallationSelection = (
  input: Readonly<InstallationSelection>,
  catalog: readonly InstallationCatalogItem[]
) => {
  const requested = installationSelectionSchema.parse(input);
  const selection = installationSelectionSchema.parse(input);
  const selected = new Map<string, InstallationCatalogItem>();
  const reasons: Record<string, string[]> = {};
  const issues: string[] =
    requested.gateway === undefined ? ["Choose a model gateway."] : [];
  const find = (source: string, kind: Definition["kind"]) =>
    catalog.find(
      (item) =>
        item.definition?.kind === kind &&
        (item.definition.id === source ||
          item.name === source ||
          `@chatjs/${item.name}` === source)
    );
  const visit = (item: InstallationCatalogItem, reason?: string): void => {
    if (reason !== undefined) {
      reasons[item.name] = [
        ...new Set([...(reasons[item.name] ?? []), reason]),
      ];
    }
    if (selected.has(item.name)) {
      return;
    }
    selected.set(item.name, item);
    for (const name of item.dependencies) {
      const dependency = catalog.find((candidate) => candidate.name === name);
      if (dependency) {
        visit(dependency, item.title);
      } else {
        issues.push(`${item.title} requires unavailable item ${name}.`);
      }
    }
    if (item.definition?.kind === "plugin") {
      for (const id of item.definition.requiresPlugins ?? []) {
        const dependency = find(id, "plugin");
        if (dependency) {
          visit(dependency, item.title);
        } else {
          issues.push(`${item.title} requires unavailable plugin ${id}.`);
        }
      }
    }
  };
  const choose = (source: string | undefined, kind: Definition["kind"]) => {
    if (source === undefined) {
      return null;
    }
    const item = find(source, kind);
    if (item) {
      visit(item);
    } else {
      issues.push(`Unknown ${kind}: ${source}.`);
    }
    return item?.definition;
  };
  for (const id of requested.plugins) {
    choose(id, "plugin");
  }
  for (const id of requested.tools) {
    choose(id, "tool");
  }
  const gateway = choose(requested.gateway, "gateway") ?? undefined;
  const storage = choose(requested.storage?.source, "storage") ?? undefined;
  const sandbox = choose(requested.sandbox, "sandbox") ?? undefined;
  if (gateway) {
    selection.gateway = gateway.id;
  }
  if (storage && selection.storage) {
    selection.storage.source = storage.id;
  }
  if (sandbox) {
    selection.sandbox = sandbox.id;
  }
  // Iterate the growing graph so dependencies of inferred providers are resolved too.
  for (const item of selected.values()) {
    if (item.definition?.kind !== "tool") {
      continue;
    }
    for (const [slot, id] of Object.entries(defaultToolProviders)) {
      if (
        item.definition.requiresTools.includes(slot) &&
        ![...selected.values()].some(
          (candidate) =>
            candidate.definition?.kind === "tool" &&
            candidate.definition.slot === slot
        )
      ) {
        const dependency = find(id, "tool");
        if (dependency) {
          visit(dependency, item.title);
        }
      }
    }
  }
  const definitions = [...selected.values()].flatMap((item) =>
    item.definition ? [item.definition] : []
  );
  selection.plugins = definitions
    .filter((item) => item.kind === "plugin")
    .map((item) => item.id);
  selection.tools = definitions
    .filter((item) => item.kind === "tool")
    .map((item) => item.id);
  issues.push(
    ...providerIssues(definitions, gateway, storage, sandbox),
    ...toolIssues(definitions),
    ...storageIssues(selection, storage)
  );
  return {
    requested,
    selection,
    reasons,
    issues: [...new Set(issues)],
    items: [...selected.values()],
  };
};
