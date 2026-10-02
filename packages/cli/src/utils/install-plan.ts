import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { installItems } from "../registry/shadcn";
import type { planInstallation } from "./installation-plan";
import { preflight } from "./preflight";

type Plan = Awaited<ReturnType<typeof planInstallation>>;
const receiptFile = ".chatjs/installed-source.json";
const receiptSchema = z.record(z.string(), z.string());
const hash = (content: Buffer) =>
  createHash("sha256").update(content).digest("hex");

const optionalFile = async (file: string) => {
  try {
    return await readFile(file);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const readReceipt = async (cwd: string) => {
  await preflight(cwd, [receiptFile]);
  const source = await optionalFile(path.join(cwd, receiptFile));
  return source ? receiptSchema.parse(JSON.parse(source.toString())) : {};
};

const sourceTargets = (plan: Plan) => [
  ...new Set(
    plan.items.flatMap((item) =>
      (item.files ?? []).flatMap((file) =>
        file.target?.startsWith("~/") ? [file.target.slice(2)] : []
      )
    )
  ),
];

const directoryFiles = async (
  cwd: string,
  directory: string
): Promise<string[]> => {
  const entries = await readdir(path.join(cwd, directory), {
    withFileTypes: true,
  });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        throw new Error(`Invalid or symlinked ChatJS target: ${target}`);
      }
      return entry.isDirectory() ? await directoryFiles(cwd, target) : [target];
    })
  );
  return files.flat();
};

/** Capture only source we actually installed. Never bless a skipped user file. */
export const recordInstalledSource = async (cwd: string, targets: string[]) => {
  const receipt = await readReceipt(cwd);
  await preflight(cwd, targets);
  for (const target of targets) {
    // oxlint-disable-next-line no-await-in-loop -- Hash each installed file without keeping all source in memory.
    const content = await optionalFile(path.join(cwd, target));
    if (content) {
      receipt[target] = hash(content);
    }
  }
  await mkdir(path.join(cwd, ".chatjs"), { recursive: true });
  await writeFile(
    path.join(cwd, receiptFile),
    `${JSON.stringify(receipt, null, 2)}\n`
  );
};

export const plannedSourceTargets = sourceTargets;

/** Validate protection before mutation; stage retired exclusive sources until registration succeeds. */
export const installPlan = async (
  cwd: string,
  plan: Plan,
  options: { overwrite?: boolean; fresh?: boolean; managedTargets?: string[] },
  register: () => Promise<void>
) => {
  const targets = [...sourceTargets(plan), ...(options.managedTargets ?? [])];
  const retired = await Promise.all(
    plan.replacements.map(({ previous }) =>
      directoryFiles(cwd, `tools/chatjs/${previous.id}`)
    )
  );
  const protectedTargets = [...targets, ...retired.flat()];
  await preflight(cwd, protectedTargets);
  const receipt = await readReceipt(cwd);
  const existing = new Map(
    await Promise.all(
      targets.map(
        async (target) =>
          [target, await optionalFile(path.join(cwd, target))] as const
      )
    )
  );
  // A replacement writes shared source. Unknown/native source requires explicit authorization.
  const replacingShared = plan.items.some(
    (item) =>
      item.meta?.chatjs?.kind === "gateway" ||
      item.meta?.chatjs?.kind === "storage"
  );
  const protectedFiles =
    plan.replacements.length || replacingShared ? protectedTargets : [];
  if (!options.fresh && !options.overwrite) {
    for (const target of protectedFiles) {
      // oxlint-disable-next-line no-await-in-loop -- Fail before any installer writes.
      const content = await optionalFile(path.join(cwd, target));
      if (content && receipt[target] !== hash(content)) {
        throw new Error(
          `${target} is modified or has no installed-source baseline. Review it and pass --overwrite to authorize replacing it. No source was installed.`
        );
      }
    }
  }
  const staged: { from: string; to: string }[] = [];
  await mkdir(path.join(cwd, ".chatjs"), { recursive: true });
  try {
    await installItems(
      plan.sources,
      cwd,
      Boolean(options.overwrite || options.fresh || replacingShared)
    );
    for (const { previous } of plan.replacements) {
      const from = path.join(cwd, "tools/chatjs", previous.id);
      const to = path.join(
        cwd,
        ".chatjs",
        `replaced-${previous.id}-${randomUUID()}`
      );
      // oxlint-disable-next-line no-await-in-loop -- Stage each old provider before registering the new complete installation.
      await rename(from, to);
      staged.push({ from, to });
    }
    await register();
  } catch (error) {
    // Restore old source even when shadcn or registration failed; new source may need repair.
    await Promise.all(staged.map(({ from, to }) => rename(to, from)));
    await Promise.all(
      [...existing].map(async ([target, content]) => {
        if (content) {
          await writeFile(path.join(cwd, target), content);
        }
      })
    );
    throw new Error(
      `Installation did not complete. Previous provider source is preserved; newly installed source/dependencies may remain. Fix the reported problem and retry the same add command with --overwrite after reviewing partial source, or run chat-js sync after manual source integration. ${error instanceof Error ? error.message : error}`,
      { cause: error }
    );
  }
  await Promise.all(
    staged.map(({ to }) => rm(to, { force: true, recursive: true }))
  );
  await recordInstalledSource(
    cwd,
    targets.filter(
      (target) =>
        !existing.get(target) ||
        options.overwrite ||
        options.fresh ||
        replacingShared
    )
  );
};
