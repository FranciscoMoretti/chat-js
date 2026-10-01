import {
  featureDefinitionSchema,
  toolDefinitionSchema,
} from "../../../registry/metadata";
import type { ToolDefinition } from "../../../registry/metadata";
import { itemAddress, readItem } from "../registry/shadcn";
import { readInstalledTools, validateToolInstallation } from "./sync-tools";

/** Resolve the complete target installation before any source files are written. */
export const planToolInstallation = async (
  cwd: string,
  requested: string[]
) => {
  const installed = await readInstalledTools(cwd);
  const expected = new Map<string, ToolDefinition>();
  const sources = new Set<string>();
  let mcp = false;
  const visit = async (source: string): Promise<void> => {
    if (sources.has(source)) {
      return;
    }
    sources.add(source);
    const item = await readItem(source, cwd);
    if (item.meta?.chatjs?.kind === "feature") {
      featureDefinitionSchema.parse(item.meta.chatjs);
      mcp = true;
    }
    if (item.meta?.chatjs?.kind === "tool") {
      const definition = toolDefinitionSchema.parse(item.meta.chatjs);
      const previous = expected.get(definition.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(definition)) {
        throw new Error(
          `Conflicting requested descriptors for ${definition.id}.`
        );
      }
      expected.set(definition.id, definition);
    }
    await Promise.all((item.registryDependencies ?? []).map(visit));
  };
  await Promise.all(
    requested.map((source) => visit(itemAddress(source, "tool")))
  );
  const target = () => [
    ...new Map([
      ...installed.map((item) => [item.id, item] as const),
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
  return { expected: [...expected.values()], mcp, sources: [...sources] };
};
