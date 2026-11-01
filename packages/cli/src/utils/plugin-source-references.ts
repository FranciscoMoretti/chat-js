import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { optionalFile } from "./installation-files";
import { preflight } from "./preflight";

const ignored = new Set([
  "node_modules",
  ".git",
  ".chatjs",
  ".next",
  ".eve",
  ".output",
  ".turbo",
  "dist",
]);
const installationBackup =
  /^chatjs\/(?:removed-plugins|replaced-[^/]+)(?:\/|$)/u;
const sourceExtension = /\.[cm]?[jt]sx?$/u;

export const sourceImports = (file: string, source: string): string[] =>
  ts
    .preProcessFile(source, true, true)
    .importedFiles.flatMap(({ fileName }) => {
      if (fileName.startsWith("@/")) {
        return [fileName.slice(2)];
      }
      if (fileName.startsWith(".")) {
        return [
          path.posix.normalize(
            path.posix.join(path.posix.dirname(file), fileName)
          ),
        ];
      }
      return [];
    });

/** Keep schema dependencies at their original paths; never rewrite imports. */
export const schemaSourceClosure = async (
  cwd: string,
  roots: readonly string[],
  pluginId: string
): Promise<Set<string>> => {
  for (const file of roots) {
    if (!file.startsWith(`chatjs/plugins/${pluginId}/`)) {
      throw new Error(
        `Database schema must belong to plugin ${pluginId}: ${file}`
      );
    }
  }
  const kept = new Set<string>();
  const visit = async (file: string): Promise<void> => {
    if (kept.has(file)) {
      return;
    }
    await preflight(cwd, [file]);
    const source = await readFile(path.join(cwd, file), "utf-8");
    kept.add(file);
    await Promise.all(
      sourceImports(file, source).map(async (imported) => {
        if (!imported.startsWith(`chatjs/plugins/${pluginId}/`)) {
          return;
        }
        const stem = imported.replace(/\.[cm]?js$/u, "");
        const candidates = [
          ...(path.posix.extname(imported) ? [imported] : []),
          `${stem}.ts`,
          `${stem}.tsx`,
          `${stem}/index.ts`,
          `${stem}/index.tsx`,
        ];
        for (const candidate of candidates) {
          // oxlint-disable-next-line no-await-in-loop -- Resolve in TypeScript source order and validate before reading.
          await preflight(cwd, [candidate]);
          // oxlint-disable-next-line no-await-in-loop -- Try the next extension only when this candidate is absent.
          if (await optionalFile(path.join(cwd, candidate))) {
            // oxlint-disable-next-line no-await-in-loop -- Retain the first resolved module before returning.
            await visit(candidate);
            return;
          }
        }
        throw new Error(
          `Cannot retain schema dependency ${imported}. Resolve it before removing ${pluginId}.`
        );
      })
    );
  };
  await Promise.all(roots.map(visit));
  return kept;
};

/** Find supported static references without changing source. */
export const findSourceReferences = async (
  cwd: string,
  targets: ReadonlySet<string>,
  excluded: ReadonlySet<string> = new Set()
): Promise<{ file: string; target: string }[]> => {
  const references: { file: string; target: string }[] = [];
  const stems = new Map(
    [...targets].map((file) => [file.replace(sourceExtension, ""), file])
  );
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(path.join(cwd, directory), {
      withFileTypes: true,
    })) {
      if (ignored.has(entry.name)) {
        continue;
      }
      const file = path.posix.join(directory, entry.name);
      if (excluded.has(file) || installationBackup.test(file)) {
        continue;
      }
      if (entry.isSymbolicLink()) {
        throw new Error(`Cannot check source behind symlink: ${file}`);
      }
      if (entry.isDirectory()) {
        // oxlint-disable-next-line no-await-in-loop -- Bound traversal and stop on the first actionable dangling import.
        await visit(file);
      } else if (sourceExtension.test(file)) {
        // oxlint-disable-next-line no-await-in-loop -- Read one source at a time to bound memory.
        const source = await readFile(path.join(cwd, file), "utf-8");
        for (const imported of sourceImports(file, source)) {
          const stem = imported.replace(sourceExtension, "");
          const target = targets.has(imported)
            ? imported
            : (stems.get(stem) ?? stems.get(`${stem}/index`));
          if (target !== undefined) {
            references.push({ file, target });
          }
        }
      }
    }
  };
  await visit("");
  return references.toSorted(
    (a, b) => a.file.localeCompare(b.file) || a.target.localeCompare(b.target)
  );
};

/** Reject dangling user imports instead of rewriting arbitrary application code. */
export const assertNoRemovedImports = async (
  cwd: string,
  removed: ReadonlySet<string>,
  generated: ReadonlySet<string>
): Promise<void> => {
  const [dangling] = await findSourceReferences(
    cwd,
    removed,
    new Set([...removed, ...generated])
  );
  if (dangling !== undefined) {
    throw new Error(
      `${dangling.file} imports removed source ${dangling.target}. Update this app-owned integration before removing the plugin.`
    );
  }
};
