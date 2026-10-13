import { readFile, readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";

import path from "node:path";

const optionalFile = async (file: string): Promise<Buffer | null> => {
  try {
    return await readFile(file);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const directoryFiles = async (
  cwd: string,
  directory: string
): Promise<string[]> => {
  const entries = await readdir(path.join(cwd, directory), {
    withFileTypes: true,
  });
  const files = await Promise.all(
    entries.map(async (entry: Readonly<Dirent>) => {
      const target = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        throw new Error(`Invalid or symlinked ChatJS target: ${target}`);
      }
      if (entry.isDirectory()) {
        return await directoryFiles(cwd, target);
      }
      return [target];
    })
  );
  return files.flat();
};

export { directoryFiles, optionalFile };
