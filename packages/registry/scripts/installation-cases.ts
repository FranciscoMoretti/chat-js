import { registry } from "../registry";
import { demoInstallation } from "../installation";
import type { InstallationSelection } from "../installation";
import { pluginDefinitionSchema, toolDefinitionSchema } from "../metadata";

const plugins = registry.items.flatMap((item) => {
  const result = pluginDefinitionSchema.safeParse(item.meta?.chatjs);
  return result.success ? [result.data] : [];
});

export const pluginPrerequisites = (ids: readonly string[]): string[] => {
  const selected = new Set(ids);
  for (const id of selected) {
    const plugin = plugins.find((candidate) => candidate.id === id);
    if (!plugin) {
      throw new Error(`Unknown plugin prerequisite: ${id}`);
    }
    for (const required of plugin.requiresPlugins ?? []) {
      selected.add(required);
    }
  }
  return [...selected].toSorted();
};

// Group by actual contribution fields, not a second list of plugin names.
const channels = new Map<string, string[]>();
for (const plugin of plugins) {
  const points = [
    ...(plugin.chat ? ["chat"] : []),
    ...((plugin.databaseSchemas?.length ?? 0) > 0 ? ["databaseSchemas"] : []),
    ...["server", "client"].flatMap((kind) => {
      const values = kind === "server" ? plugin.server : plugin.client;
      return Object.entries(values ?? {}).flatMap(([key, value]) =>
        value === true || (Array.isArray(value) && value.length > 0)
          ? [`${kind}.${key}`]
          : []
      );
    }),
  ];
  for (const point of points) {
    channels.set(point, [...(channels.get(point) ?? []), plugin.id]);
  }
}

export const combinationCases: {
  name: string;
  selection: InstallationSelection;
}[] = [];
const seen = new Set<string>();
for (const [channel, ids] of channels) {
  if (ids.length < 2) {
    continue;
  }
  const selected = pluginPrerequisites(ids);
  const key = selected.join(",");
  if (seen.has(key)) {
    continue;
  }
  seen.add(key);
  combinationCases.push({
    name: `shared ${channel}`,
    selection: { ...demoInstallation, tools: [], plugins: selected },
  });
}
combinationCases.push({
  name: "full feature preset",
  selection: demoInstallation,
});
for (const item of registry.items) {
  const parsed = toolDefinitionSchema.safeParse(item.meta?.chatjs);
  if (
    !parsed.success ||
    !parsed.data.slot ||
    demoInstallation.tools.includes(item.name)
  ) {
    continue;
  }
  const { slot } = parsed.data;
  const replaced = registry.items.find((candidate) => {
    const definition = toolDefinitionSchema.safeParse(candidate.meta?.chatjs);
    return (
      demoInstallation.tools.includes(candidate.name) &&
      definition.success &&
      definition.data.slot === slot
    );
  });
  if (replaced) {
    combinationCases.push({
      name: `full preset with ${item.name}`,
      selection: {
        ...demoInstallation,
        tools: demoInstallation.tools.map((id) =>
          id === replaced.name ? item.name : id
        ),
      },
    });
  }
}
