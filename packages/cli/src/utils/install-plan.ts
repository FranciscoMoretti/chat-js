import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { installItems } from "#cli/registry/shadcn";

import { updateEnvironmentExample } from "./environment-example";

import { prepareDependencyUpdate } from "./installation-dependencies";
import { directoryFiles, optionalFile } from "./installation-files";

import type { planInstallation } from "./installation-plan";

import { preflight } from "./preflight";
import { toolRegistrationTargets } from "./sync-tools";

type Plan = Awaited<ReturnType<typeof planInstallation>>;
type ReadonlyNative<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNative<Value[Key]> }
    : Value;
const REGISTRY_ROOT_PREFIX = "~/";
const NO_INFERRED_DESTINATIONS = 0;
const NO_REPLACEMENTS = 0;
const NO_RESTORATION_ERRORS = 0;
const RECEIPT_INDENTATION_SPACES = 2;
const SOURCE_READ_CONCURRENCY = 4;
const receiptFile = ".chatjs/installed-source.json";
const receiptSchema = z.record(z.string(), z.string());
const hash = (content: ReadonlyNative<Buffer>): string =>
  createHash("sha256").update(content).digest("hex");

const readReceipt = async (
  cwd: string
): Promise<z.infer<typeof receiptSchema>> => {
  await preflight(cwd, [receiptFile]);
  const source = await optionalFile(path.join(cwd, receiptFile));
  if (source) {
    return receiptSchema.parse(JSON.parse(source.toString()));
  }
  return {};
};
const sourceTargets = (plan: ReadonlyNative<Plan>): string[] => [
  ...new Set(
    plan.items.flatMap((item: ReadonlyNative<Plan["items"][number]>) =>
      (item.files ?? []).flatMap(
        (
          file: ReadonlyNative<
            NonNullable<Plan["items"][number]["files"]>[number]
          >
        ) => {
          if (file.target?.startsWith("~/") === true) {
            return [file.target.slice(REGISTRY_ROOT_PREFIX.length)];
          }
          return [];
        }
      )
    )
  ),
];

const sourceHashes = async (
  cwd: string,
  targets: readonly string[],
  validate?: (target: string, digest: string | null) => void
): Promise<(readonly [string, string | null])[]> => {
  const hashes: (readonly [string, string | null])[] = [];
  for (
    let offset = 0;
    offset < targets.length;
    offset += SOURCE_READ_CONCURRENCY
  ) {
    // oxlint-disable-next-line no-await-in-loop -- Bound live file buffers to four; drain each batch before reporting its first source-order read error.
    const batch = await Promise.allSettled(
      targets
        .slice(offset, offset + SOURCE_READ_CONCURRENCY)
        .map(async (target) => {
          const content = await optionalFile(path.join(cwd, target));
          const digest = content ? hash(content) : null;
          validate?.(target, digest);
          return [target, digest] as const;
        })
    );
    for (const result of batch) {
      if (result.status === "rejected") {
        throw result.reason;
      }
      hashes.push(result.value);
    }
  }
  return hashes;
};

/**
 * Capture only source we actually installed. Never bless a skipped user file.
 * @param {string} cwd Project containing the receipt and installed source files.
 * @param {readonly string[]} targets Ordered installed paths to hash without modifying the caller list.
 */
const recordInstalledSource = async (
  cwd: string,
  targets: readonly string[]
): Promise<void> => {
  const receipt = await readReceipt(cwd);
  await preflight(cwd, targets);
  for (const [target, digest] of await sourceHashes(cwd, targets)) {
    if (digest !== null) {
      receipt[target] = digest;
    }
  }
  await mkdir(path.join(cwd, ".chatjs"), { recursive: true });
  await writeFile(
    path.join(cwd, receiptFile),
    `${JSON.stringify(receipt, null, RECEIPT_INDENTATION_SPACES)}\n`
  );
};
const plannedSourceTargets = sourceTargets;

const hasProviderKind = (
  metadata: unknown,
  kind: "gateway" | "storage" | "sandbox"
): boolean =>
  typeof metadata === "object" &&
  metadata !== null &&
  "kind" in metadata &&
  metadata.kind === kind;

/**
 * Validate protection before mutation; stage retired exclusive sources until registration succeeds.
 * @param {string} cwd Project whose installed source and receipts are protected.
 * @param {ReadonlyNative<Plan>} plan Resolved items and exclusive provider replacements to install.
 * @param {{ readonly overwrite?: boolean; readonly fresh?: boolean; readonly managedTargets?: readonly string[]; readonly rollbackTargets?: readonly string[]; readonly finalize?: () => Promise<void>; }} options Authorization and extra paths for protection and rollback.
 * @param {() => Promise<void>} register Registration operation awaited before retired source is removed.
 */
const installPlan = async (
  cwd: string,
  plan: ReadonlyNative<Plan>,
  options: {
    readonly overwrite?: boolean;
    readonly fresh?: boolean;
    readonly managedTargets?: readonly string[];
    readonly rollbackTargets?: readonly string[];
    readonly finalize?: () => Promise<void>;
  },
  register: () => Promise<void>
): Promise<void> => {
  const targets = [...sourceTargets(plan), ...(options.managedTargets ?? [])];
  const retired = await Promise.all(
    plan.replacements.map(
      async ({ previous }): Promise<string[]> =>
        await directoryFiles(cwd, `tools/chatjs/${previous.id}`)
    )
  );
  const rollbackTargets = [
    "package.json",
    ".env.example",
    ".chatjs/installed-dependencies.json",
    "bun.lock",
    "bun.lockb",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    ...toolRegistrationTargets,
    "features/installed-database.ts",
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
    (item: ReadonlyNative<Plan["items"][number]>): boolean =>
      hasProviderKind(item.meta?.chatjs, "gateway") ||
      hasProviderKind(item.meta?.chatjs, "storage") ||
      hasProviderKind(item.meta?.chatjs, "sandbox")
  );
  const overwrite =
    options.overwrite === true || options.fresh === true || replacingShared;
  // The shadcn installer infers destinations for native UI files. Until those paths are
  // explicit, they cannot participate in protection or registration rollback.
  if (overwrite) {
    const unprotected = plan.items.flatMap(
      (item: ReadonlyNative<Plan["items"][number]>) =>
        (item.files ?? [])
          .filter(
            (
              file: ReadonlyNative<
                NonNullable<Plan["items"][number]["files"]>[number]
              >
            ): boolean => file.target?.startsWith("~/") !== true
          )
          .map(
            (
              file: ReadonlyNative<
                NonNullable<Plan["items"][number]["files"]>[number]
              >
            ): string => `${item.name}: ${file.path}`
          )
    );
    if (unprotected.length > NO_INFERRED_DESTINATIONS) {
      throw new Error(
        `Cannot safely overwrite inferred installer destinations: ${unprotected.join(", ")}. Give these registry files explicit ~/ targets before combining them with provider installation or --overwrite. No source was installed.`
      );
    }
  }
  const protectedFiles =
    plan.replacements.length > NO_REPLACEMENTS || replacingShared
      ? [...targets, ...retired.flat()]
      : [];
  if (!(options.fresh === true) && !(options.overwrite === true)) {
    await sourceHashes(cwd, protectedFiles, (target, digest) => {
      if (digest !== null && receipt[target] !== digest) {
        throw new Error(
          `${target} is modified or has no installed-source baseline. Review it and pass --overwrite to authorize replacing it. No source was installed.`
        );
      }
    });
  }
  const updateDependencies = await prepareDependencyUpdate(cwd, plan);
  const staged: { readonly from: string; readonly to: string }[] = [];
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
      // oxlint-disable-next-line no-await-in-loop -- Record each completed rename before starting the next; rollback restores exactly staged providers and must not race an outstanding rename after failure.
      await rename(from, to);
      staged.push({ from, to });
    }
    await register();
    await updateEnvironmentExample(
      cwd,
      "installed-capabilities",
      plan.environmentVariables
    );
    await updateDependencies();
    await options.finalize?.();
  } catch (error) {
    // Restore old source even when shadcn or registration failed; new source may need repair.
    const restored = await Promise.allSettled([
      ...staged.map(
        async ({
          from,
          to,
        }: Readonly<(typeof staged)[number]>): Promise<void> => {
          await rename(to, from);
        }
      ),
      ...[...existing].map(
        async ([target, content]: ReadonlyNative<
          readonly [string, Buffer | null]
        >): Promise<void> => {
          await (content
            ? writeFile(path.join(cwd, target), content)
            : rm(path.join(cwd, target), { force: true }));
        }
      ),
    ]);
    const restorationErrors = restored.flatMap(
      (result: ReadonlyNative<(typeof restored)[number]>) => {
        if (result.status === "rejected") {
          return [String(result.reason)];
        }
        return [];
      }
    );
    throw new Error(
      `Installation did not complete. ${restorationErrors.length > NO_RESTORATION_ERRORS ? `Source restoration also failed: ${restorationErrors.join("; ")}. Preserve .chatjs/replaced-* backups and restore source manually;` : "Previous provider source is preserved;"} newly installed source/dependencies may remain. Fix the reported problem and retry the same add command with --overwrite after reviewing partial source, or run chat-js sync after manual source integration. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  await Promise.all(
    staged.map(
      async ({ to }: Readonly<(typeof staged)[number]>): Promise<void> => {
        await rm(to, { force: true, recursive: true });
      }
    )
  );
  await recordInstalledSource(
    cwd,
    snapshotTargets.filter((target): boolean => {
      const previous = existing.get(target);
      // Registration can update rollback-only files. Refresh an existing baseline
      // only when the file was untouched beforehand; never bless user edits.
      if (!targets.includes(target)) {
        if (previous) {
          return receipt[target] === hash(previous);
        }
        return false;
      }
      return (
        !previous ||
        options.overwrite === true ||
        options.fresh === true ||
        replacingShared
      );
    })
  );
};
export { installPlan, plannedSourceTargets, recordInstalledSource };
