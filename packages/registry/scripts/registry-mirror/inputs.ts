import { watch } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export const changedInputs = (
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>
): string[] =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (file) => before[file] !== after[file]
  );

export const createInputs = (
  sourceRoot: string,
  globs: readonly string[]
): Readonly<{
  snapshot: () => Promise<Record<string, string>>;
  subscribe: (
    changed: () => void,
    failed: (error: unknown) => void
  ) => () => void;
}> => {
  const included = globs
    .filter((glob) => !glob.startsWith("!"))
    .map((glob) => new Bun.Glob(glob));
  const excluded = globs
    .filter((glob) => glob.startsWith("!"))
    .map((glob) => new Bun.Glob(glob.slice(1)));
  const matches = (file: string): boolean =>
    included.some((glob) => glob.match(file)) &&
    !excluded.some((glob) => glob.match(file));
  return {
    snapshot: async () => {
      const names = new Set(
        included
          .flatMap((glob) => [
            ...glob.scanSync({ cwd: sourceRoot, onlyFiles: true }),
          ])
          .filter(matches)
      );
      const entries = await Promise.all(
        [...names].toSorted().map(async (file) => {
          try {
            return [
              file,
              new Bun.CryptoHasher("sha256")
                .update(await fs.readFile(path.join(sourceRoot, file)))
                .digest("hex"),
            ] as const;
          } catch (error) {
            // Atomic saves can remove a glob result before it is read.
            if (
              error instanceof Error &&
              "code" in error &&
              error.code === "ENOENT"
            ) {
              return null;
            }
            throw error;
          }
        })
      );
      return Object.fromEntries(entries.filter((entry) => entry !== null));
    },
    subscribe: (changed, failed) => {
      // Watch literal directory prefixes, avoiding a recursive repository-wide
      // subscription (which would include node_modules). Polling covers missing roots.
      const roots = new Map<string, boolean>();
      for (const glob of globs.filter((pattern) => !pattern.startsWith("!"))) {
        const parts = glob.split("/");
        const firstPattern = parts.findIndex((part) => /[*?{[]/u.test(part));
        const count = firstPattern === -1 ? parts.length - 1 : firstPattern;
        const directory = parts.slice(0, count).join("/");
        roots.set(
          directory,
          roots.get(directory) === true || count < parts.length - 1
        );
      }
      const watchers = [...roots].flatMap(([directory, recursive]) => {
        try {
          const watcher = watch(
            path.join(sourceRoot, directory),
            { recursive },
            (_event, file) => {
              if (file === null || matches(path.posix.join(directory, file))) {
                changed();
              }
            }
          );
          watcher.on("error", failed);
          return [watcher];
        } catch (error) {
          failed(error);
          return [];
        }
      });
      return () => {
        for (const watcher of watchers) {
          watcher.close();
        }
      };
    },
  };
};
