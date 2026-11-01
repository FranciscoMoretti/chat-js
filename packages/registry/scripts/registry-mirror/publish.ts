import fs, { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { validateRelativePath, validateTargets } from "./paths";

const manifestSchema = z.strictObject({
  version: z.literal(1),
  files: z.array(z.string()),
});
const readOptional = async (file: string): Promise<Buffer | null> => {
  try {
    return await readFile(file);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};
const manifestContent = (files: readonly string[]): string =>
  `${JSON.stringify({ files: [...new Set(files)].toSorted(), version: 1 }, null, 2)}\n`;
const writeManifest = async (file: string, content: string): Promise<void> => {
  const temporary = await mkdtemp(
    path.join(path.dirname(file), ".registry-mirror-")
  );
  try {
    await writeFile(path.join(temporary, "manifest"), content);
    await fs.rename(path.join(temporary, "manifest"), file);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};

const validateOwnership = (
  destinationRoot: string,
  manifestPath: string,
  desired: readonly string[],
  targets: readonly string[],
  ownedPaths: readonly string[]
): void => {
  const allowed = new Set(ownedPaths);

  for (const file of desired) {
    validateRelativePath(file);
    if (!allowed.has(file)) {
      throw new Error(`Output outside registry-mirror ownership: ${file}`);
    }
  }
  for (const file of targets) {
    validateRelativePath(file);
    if (
      path.resolve(destinationRoot, file) === path.resolve(manifestPath) ||
      path.resolve(destinationRoot, file) ===
        path.resolve(`${manifestPath}.lock`) ||
      path.resolve(destinationRoot, file) ===
        path.resolve(`${manifestPath}.watch.lock`)
    ) {
      throw new Error(`Registry-mirror output overlaps its manifest: ${file}`);
    }
  }
};

/** The manifest grants cleanup ownership of prior outputs, never their contents. */
export const publishFiles = async (
  options: Readonly<{
    destinationRoot: string;
    manifestPath: string;
    ownedPaths: readonly string[];
    files: ReadonlyMap<string, Uint8Array>;
    check?: boolean;
  }>
): Promise<void> => {
  const { destinationRoot, manifestPath, files, check } = options;
  await validateTargets(path.dirname(manifestPath), [
    path.basename(manifestPath),
  ]);
  const previous = await readOptional(manifestPath);
  const recorded = previous
    ? manifestSchema.parse(JSON.parse(previous.toString())).files
    : [];
  const desired = [...files.keys()].toSorted();
  const targets = [...new Set([...recorded, ...desired])].toSorted();
  validateOwnership(
    destinationRoot,
    manifestPath,
    desired,
    targets,
    options.ownedPaths
  );
  await validateTargets(destinationRoot, targets);
  const compared = await Promise.all(
    targets.map(async (file) => {
      const content = files.get(file);
      const current = await readOptional(path.join(destinationRoot, file));
      const unchanged =
        content === undefined
          ? current === null
          : current?.equals(content) === true;
      return unchanged ? null : { file, content };
    })
  );
  const changes = compared.filter((change) => change !== null);
  const next = manifestContent(desired);
  if (check === true) {
    if (changes.length || previous?.toString() !== next) {
      throw new Error(
        `Registry-mirror drift:\n${changes.map(({ file }) => file).join("\n")}\nRun the mirror to regenerate these outputs.`
      );
    }
    return;
  }
  if (!changes.length && previous?.toString() === next) {
    return;
  }
  const staging = await mkdtemp(
    path.join(destinationRoot, ".registry-mirror-")
  );
  try {
    // Finish staging before publishing. Drain all writes before removing staging.
    const staged = await Promise.allSettled(
      changes.map(async ({ content }, index) => {
        if (content !== undefined) {
          await writeFile(path.join(staging, String(index)), content);
        }
      })
    );
    for (const result of staged) {
      if (result.status === "rejected") {
        throw result.reason;
      }
    }
    // Record additions before publication so a partial I/O failure is repairable,
    // including when the next generation no longer includes an added output.
    const pending = manifestContent(targets);
    if (previous?.toString() !== pending) {
      await writeManifest(manifestPath, pending);
    }
    for (const [index, { file, content }] of changes.entries()) {
      const target = path.join(destinationRoot, file);
      if (content === undefined) {
        // oxlint-disable-next-line no-await-in-loop -- Publish sequentially; never recursively remove an output directory.
        await rm(target, { force: true });
      } else {
        // oxlint-disable-next-line no-await-in-loop -- Prepare each destination before replacing its file.
        await mkdir(path.dirname(target), { recursive: true });
        // oxlint-disable-next-line no-await-in-loop -- Each file replacement is atomic; the entire installation is not.
        await fs.rename(path.join(staging, String(index)), target);
      }
    }
    if (pending !== next) {
      await writeManifest(manifestPath, next);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};
