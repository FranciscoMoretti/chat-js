import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { addRegistryItems, getRegistriesConfig } from "shadcn/registry";
import type { RegistryItem } from "shadcn/schema";
import { readProjectFiles } from "./project-files";
import type { ProjectFiles } from "./project-files";

export type { RegistryItem } from "shadcn/schema";

const relativePath = (file: string): string => {
  if (
    !file ||
    path.posix.isAbsolute(file) ||
    path.win32.isAbsolute(file) ||
    file.includes("\\") ||
    file
      .split("/")
      .some((part) => ["", ".", "..", "node_modules"].includes(part))
  ) {
    throw new Error(`Invalid project path: ${file}`);
  }
  return file;
};

export interface RegistryProject {
  readonly directory: string;
  /** Additional items support caller-generated patches without changing the source catalog. */
  readonly install: (
    sources: readonly string[],
    additionalItems?: readonly RegistryItem[]
  ) => Promise<void>;
  readonly readFiles: () => Promise<Map<string, Uint8Array>>;
}

/** A disposable source-only project. Never installs npm dependencies. */
export const withRegistryProject = async <Result>(
  options: Readonly<{
    namespace: string;
    items: readonly RegistryItem[];
    files: ProjectFiles;
    protectedPaths?: readonly string[];
    /** Prerequisites verified by the caller; never fetched or overwritten here. */
    preinstalledRegistryDependencies?: readonly string[];
  }>,
  operation: (project: RegistryProject) => Promise<Result>
): Promise<{ result: Result; timings: Record<string, number> }> => {
  if (!/^@[a-z0-9][a-z0-9-]*$/u.test(options.namespace)) {
    throw new Error(`Invalid registry namespace: ${options.namespace}`);
  }
  const timings: Record<string, number> = {};
  const started = performance.now();
  const directory = await mkdtemp(path.join(tmpdir(), "registry-validation-"));
  const items = new Map(options.items.map((item) => [item.name, item]));
  const preinstalled = new Set(options.preinstalledRegistryDependencies);
  if (items.size !== options.items.length) {
    await rm(directory, { recursive: true, force: true });
    throw new Error("Duplicate registry item names");
  }
  let server: Bun.Server<undefined> | undefined;
  try {
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const name = new URL(request.url).pathname
          .slice(1)
          .replace(/\.json$/u, "");
        const item = items.get(name);
        return item
          ? Response.json({
              ...item,
              dependencies: [],
              devDependencies: [],
              registryDependencies: item.registryDependencies?.filter(
                (dependency) => !preinstalled.has(dependency)
              ),
            })
          : new Response("Not found", { status: 404 });
      },
    });
    const writes = await Promise.allSettled(
      [...options.files].map(async ([file, content]) => {
        const target = path.join(directory, relativePath(file));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, content);
      })
    );
    for (const result of writes) {
      if (result.status === "rejected") {
        throw result.reason;
      }
    }
    const original: unknown = JSON.parse(
      new TextDecoder().decode(options.files.get("components.json"))
    );
    if (
      typeof original !== "object" ||
      original === null ||
      Array.isArray(original)
    ) {
      throw new Error("Project components.json must contain an object");
    }
    // Only the supplied local catalog is available in this source-only adapter.
    await writeFile(
      path.join(directory, "components.json"),
      JSON.stringify({
        ...original,
        registries: {
          [options.namespace]: `http://127.0.0.1:${server.port}/{name}.json`,
        },
      })
    );
    timings.contextMs = performance.now() - started;
    const result = await operation({
      directory,
      install: async (sources, additionalItems = []) => {
        const before = performance.now();
        for (const item of additionalItems) {
          if (items.has(item.name)) {
            throw new Error(`Duplicate registry item: ${item.name}`);
          }
          items.set(item.name, item);
        }
        const visited = new Set<string>();
        const check = (source: string): void => {
          if (preinstalled.has(source)) {
            return;
          }
          if (!source.startsWith(`${options.namespace}/`)) {
            throw new Error(
              `Source validation requires the local ${options.namespace} registry: ${source}`
            );
          }
          if (visited.has(source)) {
            return;
          }
          visited.add(source);
          const item = items.get(source.slice(options.namespace.length + 1));
          if (!item) {
            throw new Error(`Unknown registry source: ${source}`);
          }
          for (const key of [
            "css",
            "cssVars",
            "envVars",
            "tailwind",
          ] as const) {
            if (item[key] !== undefined) {
              throw new Error(
                `Source validation does not support ${key}: ${item.name}`
              );
            }
          }
          for (const file of item.files ?? []) {
            if (
              file.type !== "registry:file" ||
              !file.target?.startsWith("~/") ||
              file.content === undefined
            ) {
              throw new Error(
                `Source validation requires embedded content and an explicit registry:file target: ${file.path}`
              );
            }
            const target = relativePath(file.target.slice(2));
            if (
              [
                "components.json",
                "package.json",
                "tsconfig.json",
                ...(options.protectedPaths ?? []),
              ].includes(target)
            ) {
              throw new Error(`Protected installation target: ${target}`);
            }
          }
          for (const dependency of item.registryDependencies ?? []) {
            check(dependency);
          }
        };
        for (const source of sources) {
          check(source);
        }
        await addRegistryItems([...sources], {
          config: await getRegistriesConfig(directory),
          cwd: directory,
          overwrite: true,
          silent: true,
        });
        timings.installMs =
          (timings.installMs ?? 0) + performance.now() - before;
      },
      readFiles: async () => {
        const before = performance.now();
        const files = await readProjectFiles(directory);
        timings.collectMs =
          (timings.collectMs ?? 0) + performance.now() - before;
        return files;
      },
    });
    return { result, timings };
  } finally {
    const before = performance.now();
    try {
      await server?.stop(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
      timings.cleanupMs = performance.now() - before;
    }
  }
};
