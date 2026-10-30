import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pluginIdSchema } from "../../../registry/metadata";
import { directoryFiles, optionalFile } from "./installation-files";
import { readInstalledPlugins } from "./installed-plugins";
import {
  assertNoRemovedImports,
  schemaSourceClosure,
} from "./plugin-source-references";
import { preflight } from "./preflight";
import {
  readRetainedSchemas,
  retainedSchemasFile,
} from "./retained-plugin-schemas";
import { hash, readReceipt, receiptFile } from "./source-receipt";
import { planPluginRegistrations } from "./sync-plugins";
import { writeGeneratedFiles } from "./write-generated-files";

export const planPluginRemoval = async (
  cwd: string,
  ids: readonly string[]
) => {
  const selected = new Set(ids.map((id) => pluginIdSchema.parse(id)));
  if (selected.size === 0) {
    throw new Error("Select at least one installed plugin.");
  }
  const plugins = await readInstalledPlugins(cwd);
  for (const id of selected) {
    if (!plugins.some((plugin) => plugin.id === id)) {
      throw new Error(`Plugin is not installed: ${id}`);
    }
  }
  const remaining = plugins.filter((plugin) => !selected.has(plugin.id));
  const retiring = plugins.filter((plugin) => selected.has(plugin.id));
  const retained = await readRetainedSchemas(cwd);
  const preserved = new Set<string>();
  const candidates = new Set<string>();
  for (const plugin of retiring) {
    // oxlint-disable-next-line no-await-in-loop -- Validate each owned directory before enumerating it.
    await preflight(cwd, [`plugins/${plugin.id}/chatjs.json`]);
    // oxlint-disable-next-line no-await-in-loop -- Collect complete ownership including local files before preparing the transaction.
    const files = await directoryFiles(cwd, `plugins/${plugin.id}`);
    for (const file of [...files, ...plugin.files]) {
      candidates.add(file);
    }
    if (plugin.databaseSchemas && plugin.databaseSchemas.length > 0) {
      retained[plugin.id] = plugin.databaseSchemas;
      // oxlint-disable-next-line no-await-in-loop -- Compute the plugin's schema closure before deciding which of its files can retire.
      for (const file of await schemaSourceClosure(
        cwd,
        plugin.databaseSchemas,
        plugin.id
      )) {
        preserved.add(file);
      }
    }
  }
  for (const plugin of remaining) {
    for (const file of plugin.files) {
      if (candidates.has(file)) {
        throw new Error(
          `Cannot remove shared source ${file}; also owned by ${plugin.id}.`
        );
      }
    }
  }
  const files = [...candidates]
    .filter((file) => !preserved.has(file))
    .toSorted();
  await preflight(cwd, files);
  const registrations = await planPluginRegistrations(cwd, remaining, retained);
  await assertNoRemovedImports(
    cwd,
    new Set(files),
    new Set(registrations.keys())
  );
  const receipt = await readReceipt(cwd);
  const modified: string[] = [];
  const originals = new Map<string, Buffer>();
  await Promise.all(
    files.map(async (file) => {
      const source = await optionalFile(path.join(cwd, file));
      if (source) {
        originals.set(file, source);
        if (receipt[file] !== hash(source)) {
          modified.push(file);
        }
      }
    })
  );
  registrations.set(
    retainedSchemasFile,
    `${JSON.stringify(retained, null, 2)}\n`
  );
  registrations.set(
    receiptFile,
    `${JSON.stringify(Object.fromEntries(Object.entries(receipt).filter(([file]) => !candidates.has(file) || preserved.has(file))), null, 2)}\n`
  );
  return {
    ids: [...selected],
    files,
    modified: modified.toSorted(),
    preserved: [...preserved].toSorted(),
    registrations,
    originals,
  };
};

/** Removal is planned before mutation and rolled back on registration failure. */
export const removePlugins = async (
  cwd: string,
  ids: readonly string[],
  options: Readonly<{ backup?: boolean; dryRun?: boolean }> = {}
) => {
  const plan = await planPluginRemoval(cwd, ids);
  if (options.dryRun === true) {
    return { ...plan, backup: undefined };
  }
  if (plan.modified.length > 0 && options.backup !== true) {
    throw new Error(
      `Modified or untracked plugin source:\n${plan.modified.join("\n")}\nReview with --dry-run, then use --backup to preserve these files outside active source. Nothing was removed.`
    );
  }
  const backup = `chatjs/removed-plugins/${randomUUID()}`;
  const updates = [...plan.registrations.keys()];
  await preflight(cwd, [
    ...updates,
    ...plan.files.map((file) => `${backup}/${file}.bak`),
  ]);
  const previous = new Map(
    await Promise.all(
      updates.map(
        async (file) =>
          [file, await optionalFile(path.join(cwd, file))] as const
      )
    )
  );
  const moved: string[] = [];
  try {
    for (const [file, source] of plan.originals) {
      // oxlint-disable-next-line no-await-in-loop -- Recheck each file immediately before moving it; never discard an edit made since planning.
      const current = await optionalFile(path.join(cwd, file));
      if (!current || hash(current) !== hash(source)) {
        throw new Error(
          `${file} changed during removal; retry after reviewing it.`
        );
      }
      const target = path.join(cwd, backup, `${file}.bak`);
      // oxlint-disable-next-line no-await-in-loop -- Record each move before proceeding so rollback restores exactly what moved.
      await mkdir(path.dirname(target), { recursive: true });
      // oxlint-disable-next-line no-await-in-loop -- See transaction ordering above.
      await rename(path.join(cwd, file), target);
      moved.push(file);
    }
    await writeGeneratedFiles(cwd, plan.registrations);
  } catch (error) {
    const restored = await Promise.allSettled([
      ...moved.map(async (file) => {
        await rename(
          path.join(cwd, backup, `${file}.bak`),
          path.join(cwd, file)
        );
      }),
      ...[...previous].map(async ([file, source]) => {
        if (source) {
          await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
          await writeFile(path.join(cwd, file), source);
        } else {
          await rm(path.join(cwd, file), { force: true });
        }
      }),
    ]);
    const failures = restored.filter((result) => result.status === "rejected");
    throw new Error(
      `Plugin removal failed. ${failures.length ? `Recovery required; preserve ${backup}.` : "Previous source and registrations restored."} ${String(error)}`,
      { cause: error }
    );
  }
  // Only empty directories are removed; retained schemas and unknown files survive.
  const directories = new Set<string>();
  for (const file of plan.files) {
    let directory = path.posix.dirname(file);
    while (directory !== ".") {
      directories.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  for (const directory of [...directories].toSorted(
    (a, b) => b.length - a.length
  )) {
    // oxlint-disable-next-line no-await-in-loop -- Children must be empty before their parents can be removed.
    await rmdir(path.join(cwd, directory)).catch((error: unknown) => {
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          ["ENOENT", "ENOTEMPTY"].includes(String(error.code))
        )
      ) {
        throw error;
      }
    });
  }
  if (options.backup !== true) {
    await rm(path.join(cwd, backup), { recursive: true, force: true });
  }
  return { ...plan, backup: options.backup === true ? backup : undefined };
};
