import { constants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readlink,
  rename,
  rm,
  symlink,
} from "node:fs/promises";
import path from "node:path";

const transferEntry = async (source: string, destination: string) => {
  const stats = await lstat(source);
  if (stats.isDirectory()) {
    // Windows rename already rejects an existing directory. On POSIX, reserve
    // the name exclusively before moving the subtree (including node_modules).
    if (process.platform !== "win32") {
      await mkdir(destination);
    }
    await rename(source, destination);
  } else if (stats.isSymbolicLink()) {
    await symlink(await readlink(source), destination);
  } else {
    await copyFile(source, destination, constants.COPYFILE_EXCL);
  }
};

// Only the owned stage is disposable. Finalization never removes a user's path.
export const createStagedProject = async <T>(
  target: string,
  create: (stage: string) => Promise<T>
): Promise<T> => {
  const destination = path.resolve(target);
  await mkdir(path.dirname(destination), { recursive: true });
  const root = await mkdtemp(
    path.join(
      path.dirname(destination),
      `.${path.basename(destination)}-chatjs-`
    )
  );
  const stage = path.join(root, "app");
  await mkdir(stage);
  try {
    const result = await create(stage);
    const existing = await lstat(destination).catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error;
    });
    const entries =
      existing?.isDirectory() === true ? await readdir(destination) : [];
    if (
      existing &&
      (!existing.isDirectory() ||
        existing.isSymbolicLink() ||
        entries.length > 0)
    ) {
      throw new Error(
        `Target changed during creation: ${destination}. No existing files were replaced.`
      );
    }
    if (existing) {
      // Replacing this directory would detach shells whose cwd points to it.
      for (const entry of await readdir(stage)) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Stop transferring on failure before the owned stage is cleaned up.
        await transferEntry(
          path.join(stage, entry),
          path.join(destination, entry)
        );
      }
    } else {
      await rename(stage, destination);
    }
    return result;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};
