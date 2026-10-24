import { mkdir, readdir, symlink } from "node:fs/promises";
import path from "node:path";

// Fixtures outside the monorepo need the same dependency lookup as their source
// workspace, whether Bun installs packages locally or hoists them to an ancestor.
export const linkWorkspaceDependencies = async (
  workspace: string,
  destination: string
): Promise<void> => {
  const links = new Map<string, string>();
  const collect = async (directory: string, prefix = ""): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true }).catch(
      (error: unknown) => {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return [];
        }
        throw error;
      }
    );
    await Promise.all(
      entries.map(async (entry) => {
        const name = path.join(prefix, entry.name);
        const source = path.join(directory, entry.name);
        if (
          prefix === "" &&
          (entry.name.startsWith("@") || entry.name === ".bin")
        ) {
          await collect(source, name);
        } else if (
          (!entry.name.startsWith(".") || prefix === ".bin") &&
          !links.has(name)
        ) {
          links.set(name, source);
        }
      })
    );
  };
  let directory = path.resolve(workspace);
  while (true) {
    // oxlint-disable-next-line no-await-in-loop -- Nearest workspace dependencies must win over hoisted versions.
    await collect(path.join(directory, "node_modules"));
    const parent = path.dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }
  await Promise.all(
    [...links].map(async ([name, source]) => {
      const target = path.join(destination, "node_modules", name);
      await mkdir(path.dirname(target), { recursive: true });
      await symlink(source, target);
    })
  );
};
