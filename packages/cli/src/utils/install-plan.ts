/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { createHash, randomUUID } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { z } from "zod";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { installItems } from "../registry/shadcn";
/* oxlint-enable import/no-relative-parent-imports */
import type { planInstallation } from "./installation-plan";
import { preflight } from "./preflight";
import { toolRegistrationTargets } from "./sync-tools";

type Plan = Awaited<ReturnType<typeof planInstallation>>;
const receiptFile = ".chatjs/installed-source.json";
const receiptSchema = z.record(z.string(), z.string());
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const hash = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
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
/* oxlint-enable unicorn/no-null */

const readReceipt = async (
  cwd: string
): Promise<z.infer<typeof receiptSchema>> => {
  await preflight(cwd, [receiptFile]);
  const source = await optionalFile(path.join(cwd, receiptFile));
  return source ? receiptSchema.parse(JSON.parse(source.toString())) : {};
};

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const sourceTargets = (plan: Plan): string[] => [
  ...new Set(
    plan.items.flatMap((item) =>
      (item.files ?? []).flatMap((file) =>
        file.target?.startsWith("~/") ? [file.target.slice(2)] : []
      )
    )
  ),
];
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** Capture only source we actually installed. Never bless a skipped user file. */
const recordInstalledSource = async (
  cwd: string,
  targets: string[]
): Promise<void> => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable jsdoc/require-param */

const plannedSourceTargets = sourceTargets;

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/** Validate protection before mutation; stage retired exclusive sources until registration succeeds. */
const installPlan = async (
  cwd: string,
  plan: Plan,
  options: {
    overwrite?: boolean;
    fresh?: boolean;
    managedTargets?: string[];
    rollbackTargets?: string[];
  },
  register: () => Promise<void>
): Promise<void> => {
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
    (item): boolean =>
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
      item.meta?.chatjs?.kind === "gateway" ||
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
      item.meta?.chatjs?.kind === "storage"
  );
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- This is a logical OR of independent conditions; false must continue to the next condition rather than short-circuit as with nullish coalescing.
  const overwrite = options.overwrite || options.fresh || replacingShared;
  // The shadcn installer infers destinations for native UI files. Until those paths are
  // explicit, they cannot participate in protection or registration rollback.
  if (overwrite) {
    const unprotected = plan.items.flatMap((item) =>
      (item.files ?? [])
        .filter((file): boolean => !file.target?.startsWith("~/"))
        .map((file): string => `${item.name}: ${file.path}`)
    );
    if (unprotected.length > 0) {
      throw new Error(
        `Cannot safely overwrite inferred installer destinations: ${unprotected.join(", ")}. Give these registry files explicit ~/ targets before combining them with provider installation or --overwrite. No source was installed.`
      );
    }
  }
  const protectedFiles =
    plan.replacements.length > 0 || replacingShared
      ? [...targets, ...retired.flat()]
      : [];
  if (!(options.fresh === true) && !(options.overwrite === true)) {
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
      ...staged.map(({ from, to }): Promise<void> => rename(to, from)),
      ...[...existing].map(async ([target, content]): Promise<void> => {
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
      `Installation did not complete. ${restorationErrors.length > 0 ? `Source restoration also failed: ${restorationErrors.join("; ")}. Preserve .chatjs/replaced-* backups and restore source manually;` : "Previous provider source is preserved;"} newly installed source/dependencies may remain. Fix the reported problem and retry the same add command with --overwrite after reviewing partial source, or run chat-js sync after manual source integration. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  await Promise.all(
    staged.map(({ to }): Promise<void> =>
      rm(to, { force: true, recursive: true })
    )
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
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- This is a logical OR of independent conditions; false must continue to the next condition rather than short-circuit as with nullish coalescing.
      return !previous || options.overwrite || options.fresh || replacingShared;
    })
  );
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
export { installPlan, plannedSourceTargets, recordInstalledSource };
