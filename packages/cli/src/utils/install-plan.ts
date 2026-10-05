// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI hashes installed source using the native cryptographic implementation.
import { createHash, randomUUID } from "node:crypto";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installItems } from "#cli/registry/shadcn";
/* oxlint-enable sort-imports */

import { updateEnvironmentExample } from "./environment-example";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { prepareDependencyUpdate } from "./installation-dependencies";
import { directoryFiles, optionalFile } from "./installation-files";
/* oxlint-enable sort-imports */
import type { planInstallation } from "./installation-plan";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { assertMcpApprovalSchema } from "./mcp-schema";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/max-dependencies -- Installation composes provider validation, dependency ownership and rollback within one transaction.
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
const receiptFile = ".chatjs/installed-source.json";
const receiptSchema = z.record(z.string(), z.string());
const hash = (content: ReadonlyNative<Buffer>): string =>
  createHash("sha256").update(content).digest("hex");

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readReceipt's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
const sourceTargets = (plan: ReadonlyNative<Plan>): string[] => [
  ...new Set(
    plan.items.flatMap((item: ReadonlyNative<Plan["items"][number]>) =>
      (item.files ?? []).flatMap(
        (
          file: ReadonlyNative<
            NonNullable<Plan["items"][number]["files"]>[number]
          >
        ) => {
          // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading startsWith from file.target; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
          if (file.target?.startsWith("~/") === true) {
            return [file.target.slice(REGISTRY_ROOT_PREFIX.length)];
          }
          return [];
        }
      )
    )
  ),
];

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve recordInstalledSource's awaited sequencing and rejected-Promise behavior. */
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
    // oxlint-disable-next-line unicorn/no-null -- The null replacer preserves every receipt field while applying indentation.
    `${JSON.stringify(receipt, null, RECEIPT_INDENTATION_SPACES)}\n`
  );
};
/* oxlint-enable oxc/no-async-await */
const plannedSourceTargets = sourceTargets;

const hasProviderKind = (
  metadata: unknown,
  kind: "gateway" | "storage"
): boolean =>
  typeof metadata === "object" &&
  metadata !== null &&
  "kind" in metadata &&
  metadata.kind === kind;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve installPlan's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- Protection checks, snapshots, staged retired providers, registration, finalization, and rollback share the same transaction state. */
/* oxlint-disable eslint/max-lines-per-function -- The complete installation transaction keeps protected source snapshots and staged provider rollback in one failure boundary. */
/* oxlint-disable eslint/max-params -- The existing installation API separates project, resolved plan, overwrite/rollback options, and the deferred registration callback. */
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
  if (plan.features.some((feature): boolean => feature.id === "mcp")) {
    await assertMcpApprovalSchema(cwd);
  }
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatjs from item.meta; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      hasProviderKind(item.meta?.chatjs, "gateway") ||
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatjs from item.meta; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      hasProviderKind(item.meta?.chatjs, "storage")
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
              // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading startsWith from file.target; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
      // oxlint-disable-next-line no-await-in-loop -- Stage each old provider before registering the new complete installation.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling options.finalize; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
    await options.finalize?.();
  } catch (error) {
    // Restore old source even when shadcn or registration failed; new source may need repair.
    const restored = await Promise.allSettled([
      ...staged.map(
        async ({
          from,
          to,
        }: Readonly<(typeof staged)[number]>): Promise<void> =>
          await rename(to, from)
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
      async ({ to }: Readonly<(typeof staged)[number]>): Promise<void> =>
        await rm(to, { force: true, recursive: true })
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (installPlan, plannedSourceTargets, recordInstalledSource); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
export { installPlan, plannedSourceTargets, recordInstalledSource };
/* oxlint-enable import/no-named-export */
