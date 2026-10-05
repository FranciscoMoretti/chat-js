// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyInput } from "#cli/helpers/readonly-input";
/* oxlint-enable sort-imports */

import type { planInstallation } from "./installation-plan";
import { preflight } from "./preflight";

const dependencyReceipt = ".chatjs/installed-dependencies.json";
const dependencyMap = z.record(z.string(), z.string());
const manifestSchema = z.looseObject({
  dependencies: dependencyMap.optional(),
  devDependencies: dependencyMap.optional(),
});
const dependencyList = z.array(z.string());
const receiptSchema = z.object({
  items: z.record(z.string(), dependencyList),
  owned: dependencyMap,
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readManifest's awaited sequencing and rejected-Promise behavior. */
const readManifest = async (
  cwd: string
): Promise<z.infer<typeof manifestSchema>> => {
  const source = await readFile(path.join(cwd, "package.json"), "utf-8");
  return manifestSchema.parse(JSON.parse(source));
};
/* oxlint-enable oxc/no-async-await */
const dependencyName = (specifier: string): string =>
  specifier.replace(/(?<!^)@[^/]*$/u, "");

const ignored = new Set([
  "node_modules",
  ".git",
  ".chatjs",
  ".next",
  ".eve",
  ".output",
  ".turbo",
  "dist",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "bun.lock",
  "bun.lockb",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const binaryAssets = new Set([
  ".avif",
  ".br",
  ".eot",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".otf",
  ".pdf",
  ".png",
  ".tgz",
  ".ttf",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);
const maxSourceBytes = 1_048_576;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve sourceUses's awaited sequencing and rejected-Promise behavior. */
// Conservative protection for dependencies used by source outside registry items.
// oxlint-disable-next-line eslint/max-statements -- Keep validation, ownership checks and updates in their ordered operation so failure boundaries remain explicit.
const sourceUses = async (cwd: string, name: string): Promise<boolean> => {
  const entries = await readdir(cwd, { withFileTypes: true });
  for (const entry of entries) {
    if (
      ignored.has(entry.name) ||
      entry.name === "package.json" ||
      entry.name.endsWith(".tsbuildinfo") ||
      (entry.isFile() &&
        binaryAssets.has(path.extname(entry.name).toLowerCase()))
    ) {
      // oxlint-disable-next-line eslint/no-continue -- Skip ignored directories before examining their files.
      continue;
    }
    if (entry.isSymbolicLink()) {
      // Unknown source behind a symlink cannot prove a dependency is unused.
      return true;
    }
    const file = path.join(cwd, entry.name);
    if (entry.isDirectory()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process each installation or source entry in order and stop at the first relevant result.
      if (await sourceUses(file, name)) {
        return true;
      }
    } else if (entry.isFile()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Bound memory before reading each user-authored file.
      const metadata = await stat(file);
      if (metadata.size > maxSourceBytes) {
        // Unknown oversized source cannot prove that a dependency is unused.
        return true;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process each installation or source entry in order and stop at the first relevant result.
      const content = await readFile(file);
      if (content.includes(name)) {
        return true;
      }
    }
  }
  return false;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (prepareDependencyUpdate); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareDependencyUpdate's awaited sequencing and rejected-Promise behavior. */
// oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function -- Keep validation, ownership checks and updates in their ordered operation so failure boundaries remain explicit. Keep this installation operation and its rollback or test assertions together.
export const prepareDependencyUpdate = async (
  cwd: string,
  plan: ReadonlyInput<
    Pick<
      Awaited<ReturnType<typeof planInstallation>>,
      "items" | "replacements" | "providerChanges"
    >
  >
): Promise<() => Promise<void>> => {
  await preflight(cwd, [dependencyReceipt, "package.json"]);
  const source = await readFile(
    path.join(cwd, dependencyReceipt),
    "utf-8"
  ).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return '{"items":{},"owned":{}}';
    }
    throw error;
  });
  const receipt = receiptSchema.parse(JSON.parse(source));
  const before = await readManifest(cwd);
  for (const { previous } of plan.replacements) {
    delete receipt.items[`tool:${previous.id}`];
  }
  for (const { kind, previous, next } of plan.providerChanges) {
    if (previous !== next) {
      delete receipt.items[`${kind}:${previous}`];
    }
  }
  for (const item of plan.items) {
    const descriptor = z
      .object({ id: z.string(), kind: z.string() })
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatjs from item.meta; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      .safeParse(item.meta?.chatjs);
    const key = descriptor.success
      ? `${descriptor.data.kind}:${descriptor.data.id}`
      : `item:${item.name}`;
    receipt.items[key] = [
      ...(item.dependencies ?? []),
      ...(item.devDependencies ?? []),
    ].map((specifier) => dependencyName(specifier));
  }
  // oxlint-disable-next-line eslint/max-statements -- Keep validation, ownership checks and updates in their ordered operation so failure boundaries remain explicit.
  return async (): Promise<void> => {
    const manifest = await readManifest(cwd);
    const required = new Set(Object.values(receipt.items).flat());
    for (const name of required) {
      const version =
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from manifest.dependencies; preserve one receiver evaluation, skipped accesses and the existing manifest.devDependencies?.[name] fallback. Keep the existing nullish guard when reading name from manifest.devDependencies; preserve one receiver evaluation, skipped accesses and the existing manifest.devDependencies?.[name] fallback.
        manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
      if (
        typeof version === "string" &&
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from before.dependencies; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
        typeof before.dependencies?.[name] !== "string" &&
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from before.devDependencies; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
        typeof before.devDependencies?.[name] !== "string"
      ) {
        receipt.owned[name] = version;
      }
    }
    for (const [name, installedVersion] of Object.entries(receipt.owned)) {
      const group =
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from manifest.dependencies; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
        typeof manifest.dependencies?.[name] === "string"
          ? manifest.dependencies
          : manifest.devDependencies;
      if (
        !required.has(name) &&
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from group; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
        group?.[name] === installedVersion &&
        // oxlint-disable-next-line eslint/no-await-in-loop -- Process each installation or source entry in order and stop at the first relevant result.
        !(await sourceUses(cwd, name))
      ) {
        Reflect.deleteProperty(group, name);
        Reflect.deleteProperty(receipt.owned, name);
      }
    }
    await writeFile(
      path.join(cwd, "package.json"),
      // oxlint-disable-next-line unicorn/no-null, eslint/no-magic-numbers -- JSON.stringify accepts null to select its default replacer while retaining readable indentation. These local values specify JSON indentation, source offsets or bounded test fixtures.
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    await writeFile(
      path.join(cwd, dependencyReceipt),
      // oxlint-disable-next-line unicorn/no-null, eslint/no-magic-numbers -- JSON.stringify accepts null to select its default replacer while retaining readable indentation. These local values specify JSON indentation, source offsets or bounded test fixtures.
      `${JSON.stringify(receipt, null, 2)}\n`
    );
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
