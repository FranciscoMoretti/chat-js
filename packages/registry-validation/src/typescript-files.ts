import path from "node:path";
import ts from "typescript";

interface DirectoryEntries {
  files: string[];
  directories: string[];
}

// TypeScript 6.0.2 exports the matcher used by ts.sys.readDirectory but omits it
// from its public declarations. Keep this pinned-version seam here and verify
// it against the real compiler's file selection in the parity tests.
declare module "typescript" {
  function matchFiles(
    directory: string,
    extensions: readonly string[] | undefined,
    excludes: readonly string[] | undefined,
    includes: readonly string[] | undefined,
    caseSensitive: boolean,
    currentDirectory: string,
    depth: number | undefined,
    entries: (directory: string) => DirectoryEntries,
    realpath: (file: string) => string
  ): string[];
}

export const readVirtualDirectory = (
  files: Iterable<string>,
  root: string
): NonNullable<ts.CompilerHost["readDirectory"]> => {
  const tree = new Map<string, DirectoryEntries>();
  const entries = (directory: string): DirectoryEntries => {
    const existing = tree.get(directory);
    if (existing) {
      return existing;
    }
    const created = { files: [], directories: [] };
    tree.set(directory, created);
    return created;
  };
  for (const file of files) {
    let directory = path.posix.dirname(file);
    entries(directory).files.push(path.posix.basename(file));
    while (directory !== root && directory.startsWith(`${root}/`)) {
      const parent = path.posix.dirname(directory);
      const children = entries(parent).directories;
      const name = path.posix.basename(directory);
      if (!children.includes(name)) {
        children.push(name);
      }
      directory = parent;
    }
  }
  return (directory, extensions, excludes, includes, depth) =>
    ts.matchFiles(
      directory,
      extensions,
      excludes,
      includes,
      true,
      root,
      depth,
      (requested) =>
        tree.get(path.posix.resolve(root, requested)) ?? {
          files: [],
          directories: [],
        },
      (file) => file
    );
};
