import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export type ProjectFiles = ReadonlyMap<string, Uint8Array>;

const virtualProjectRoot = "/registry-project";

const readProjectFiles = async (
  directory: string,
  include: (relative: string) => boolean = () => true
): Promise<Map<string, Uint8Array>> => {
  const files = new Map<string, Uint8Array>();
  const visit = async (relative: string): Promise<void> => {
    const entries = await readdir(path.join(directory, relative), {
      withFileTypes: true,
    });
    await Promise.all(
      entries.map(async (entry): Promise<void> => {
        const file = path.posix.join(relative, entry.name);
        if (!include(file)) {
          return;
        }
        if (entry.isDirectory()) {
          await visit(file);
        } else if (entry.isFile()) {
          const location = path.join(directory, file);
          files.set(file, await readFile(location));
        } else {
          throw new Error(`Project contains a non-regular file: ${file}`);
        }
      })
    );
  };
  await visit("");
  return files;
};

export { readProjectFiles, virtualProjectRoot };
