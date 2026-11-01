import path from "node:path";
import type { RegistryItem } from "shadcn/schema";

/** Only plain plugin copies are independent of the composition generators. */
export const incrementalPluginFiles = async (
  options: Readonly<{
    changes?: readonly string[];
    previous?: Readonly<Record<string, string>>;
    items: readonly RegistryItem[];
    registryRoot: string;
  }>
): Promise<RegistryItem["files"] | null> => {
  const { changes, previous, items, registryRoot } = options;
  if (changes === undefined || changes.length === 0 || !previous) {
    return null;
  }
  const files = items.flatMap((item) => item.files ?? []);
  const selected = files.filter((file) =>
    changes.includes(`packages/registry/${file.path}`)
  );
  // Derive one-to-many source/target edges from the resolved installer plan.
  // Unknown paths, deleted files and target changes need full reconciliation.
  if (
    changes.some(
      (change) =>
        !/^packages\/registry\/src\/plugins\/[^/]+\/(?:src|adapters)\//u.test(
          change
        ) ||
        !selected.some((file) => `packages/registry/${file.path}` === change)
    ) ||
    selected.some(
      (file) =>
        file.target?.startsWith("~/") !== true ||
        !Object.hasOwn(previous, file.target.slice(2))
    )
  ) {
    return null;
  }
  // A manifest may import a configuration value from an otherwise ordinary
  // source file. Bundler provenance detects that dependency, including transitives.
  const graph = await Bun.build({
    entrypoints: [path.join(registryRoot, "scripts/demo-generator.ts")],
    packages: "external",
    target: "bun",
    metafile: true,
  });
  if (!graph.success || !graph.metafile) {
    return null;
  }
  const imported = new Set(
    Object.keys(graph.metafile.inputs).map((file) => path.resolve(file))
  );
  const repoRoot = path.resolve(registryRoot, "../..");
  if (changes.some((file) => imported.has(path.join(repoRoot, file)))) {
    return null;
  }
  return selected;
};
