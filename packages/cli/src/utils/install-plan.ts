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
import { toolRegistrationTargets } from "./sync-tools";

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
  options: {
    overwrite?: boolean;
    fresh?: boolean;
    managedTargets?: string[];
    rollbackTargets?: string[];
  },
  register: () => Promise<void>
) => {
  const targets = [...sourceTargets(plan), ...(options.managedTargets ?? [])];
  const retired = await Promise.all(
    plan.replacements.map(({ previous }) =>
      directoryFiles(cwd, `tools/chatjs/${previous.id}`)
    )
  );
  const rollbackTargets = [
    ...toolRegistrationTargets,
    ...(options.rollbackTargets ?? []),
  ];
  const snapshotTargets = [...new Set([...targets, ...rollbackTargets])];
  const protectedTargets = [...snapshotTargets, ...retired.flat()];
  await preflight(cwd, protectedTargets);
  const receipt = await readReceipt(cwd);
  const existing = new Map(
    await Promise.all(
      snapshotTargets.map(
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
  const overwrite = Boolean(
    options.overwrite || options.fresh || replacingShared
  );
  // shadcn infers destinations for native UI files. Until those paths are
  // explicit, they cannot participate in protection or registration rollback.
  if (overwrite) {
    const unprotected = plan.items.flatMap((item) =>
      (item.files ?? [])
        .filter((file) => !file.target?.startsWith("~/"))
        .map((file) => `${item.name}: ${file.path}`)
    );
    if (unprotected.length) {
      throw new Error(
        `Cannot safely overwrite inferred installer destinations: ${unprotected.join(", ")}. Give these registry files explicit ~/ targets before combining them with provider installation or --overwrite. No source was installed.`
      );
    }
  }
  const protectedFiles =
    plan.replacements.length || replacingShared
      ? [...targets, ...retired.flat()]
      : [];
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
    await installItems(plan.sources, cwd, overwrite);
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
    const restored = await Promise.allSettled([
      ...staged.map(({ from, to }) => rename(to, from)),
      ...[...existing].map(async ([target, content]) => {
        if (content) {
          await writeFile(path.join(cwd, target), content);
        } else if (rollbackTargets.includes(target)) {
          await rm(path.join(cwd, target), { force: true });
        }
      }),
    ]);
    const restorationErrors = restored.flatMap((result) =>
      result.status === "rejected" ? [String(result.reason)] : []
    );
    throw new Error(
      `Installation did not complete. ${restorationErrors.length ? `Source restoration also failed: ${restorationErrors.join("; ")}. Preserve .chatjs/replaced-* backups and restore source manually;` : "Previous provider source is preserved;"} newly installed source/dependencies may remain. Fix the reported problem and retry the same add command with --overwrite after reviewing partial source, or run chat-js sync after manual source integration. ${error instanceof Error ? error.message : error}`,
      { cause: error }
    );
  }
  await Promise.all(
    staged.map(({ to }) => rm(to, { force: true, recursive: true }))
  );
  await recordInstalledSource(
    cwd,
    snapshotTargets.filter((target) => {
      const previous = existing.get(target);
      // Registration can update rollback-only files. Refresh an existing baseline
      // only when the file was untouched beforehand; never bless user edits.
      if (!targets.includes(target)) {
        return previous && receipt[target] === hash(previous);
      }
      return !previous || options.overwrite || options.fresh || replacingShared;
    })
  );
};
