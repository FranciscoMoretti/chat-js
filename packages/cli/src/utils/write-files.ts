import fs from "node:fs/promises";
import path from "node:path";
import type { RegistryToolItemFile } from "../registry/schema";
import { isSafeTarget } from "./is-safe-target";

function rewriteRegistryImports(
  content: string,
  toolsAlias: string,
  uiAlias: string
): string {
  return content
    .replace(
      /(["'])@toolkit\/(lib|components|hooks)\/([^"'`]+)\1/g,
      (_match, quote: string, kind: string, rest: string) =>
        `${quote}${toolsAlias}/_shared/${kind}/${rest}${quote}`
    )
    .replace(
      /(["'])@ui\/([^"'`]+)\1/g,
      (_match, quote: string, rest: string) =>
        `${quote}${uiAlias}/${rest}${quote}`
    );
}

function prepareRegistryFiles(
  files: RegistryToolItemFile[],
  {
    toolsDir,
    toolsAlias,
    uiDir,
    uiAlias,
  }: {
    toolsDir: string;
    toolsAlias: string;
    uiDir: string;
    uiAlias: string;
  }
) {
  const destinations = new Map<
    string,
    { content: string; dest: string; rootDir: string; target: string }
  >();

  for (const file of files) {
    const rootDir = file.type === "ui" ? uiDir : toolsDir;
    if (!isSafeTarget(file.target, rootDir)) {
      throw new Error(
        `Refusing to write "${file.target}" outside its registry directory`
      );
    }

    const dest = path.resolve(rootDir, file.target);
    const content =
      dest.endsWith(".ts") || dest.endsWith(".tsx") || dest.endsWith(".js")
        ? rewriteRegistryImports(file.content, toolsAlias, uiAlias)
        : file.content;
    const existing = destinations.get(dest);
    if (existing && existing.content !== content) {
      throw new Error(
        `Registry files resolve to conflicting destination "${file.target}"`
      );
    }
    destinations.set(dest, { content, dest, rootDir, target: file.target });
  }

  return [...destinations.values()];
}

async function assertNoSymlinkTraversal(
  dest: string,
  toolsDir: string
): Promise<void> {
  const relativeParent = path.relative(toolsDir, path.dirname(dest));
  const segments = relativeParent
    .split(path.sep)
    .filter((segment) => segment.length > 0);
  let currentPath = toolsDir;

  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    const stat = await fs.lstat(currentPath).catch(() => null);
    if (stat?.isSymbolicLink()) {
      throw new Error(
        `Refusing to write through symlinked path "${path.relative(toolsDir, currentPath)}"`
      );
    }
  }
}

/**
 * Write tool files to disk.
 * Tool files resolve relative to `toolsDir`; UI files resolve relative to `uiDir`.
 * Returns the list of absolute paths that were written.
 */
export async function writeToolFiles(
  files: RegistryToolItemFile[],
  {
    overwrite = false,
    dryRun = false,
    toolsDir,
    toolsAlias,
    uiDir,
    uiAlias,
  }: {
    overwrite?: boolean;
    dryRun?: boolean;
    toolsDir: string;
    toolsAlias: string;
    uiDir: string;
    uiAlias: string;
  }
): Promise<{ written: string[]; existing: string[] }> {
  const written: string[] = [];
  const existing: string[] = [];
  const preparedFiles = prepareRegistryFiles(files, {
    toolsDir,
    toolsAlias,
    uiDir,
    uiAlias,
  });

  for (const { content, dest, rootDir, target } of preparedFiles) {
    await assertNoSymlinkTraversal(dest, rootDir);

    const destinationStat = await fs.lstat(dest).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    });
    if (destinationStat?.isSymbolicLink()) {
      throw new Error(`Refusing to overwrite symlinked file "${target}"`);
    }
    const exists = destinationStat !== null;

    if (destinationStat?.isFile()) {
      const existingContent = await fs.readFile(dest, "utf8").catch(() => null);
      if (existingContent === content) continue;
    }

    if (exists && !overwrite) {
      existing.push(dest);
      continue;
    }
    if (dryRun) {
      continue;
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    const realRootDir = await fs
      .realpath(rootDir)
      .catch(() => path.resolve(rootDir));
    const realParentDir = await fs.realpath(path.dirname(dest));
    if (
      realParentDir !== realRootDir &&
      !realParentDir.startsWith(`${realRootDir}${path.sep}`)
    ) {
      throw new Error(
        `Refusing to write "${target}" outside its registry directory`
      );
    }
    await fs.writeFile(dest, content, "utf8");
    written.push(dest);
  }

  return { written, existing };
}
