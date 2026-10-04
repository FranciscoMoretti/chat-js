import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

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

const readManifest = async (
  cwd: string
): Promise<z.infer<typeof manifestSchema>> => {
  const source = await readFile(path.join(cwd, "package.json"), "utf-8");
  return manifestSchema.parse(JSON.parse(source));
};

const dependencyName = (specifier: string): string =>
  specifier.replace(/(?<!^)@[^/]*$/u, "");

const ignored = new Set([
  "node_modules",
  ".git",
  ".chatjs",
  ".next",
  ".eve",
  ".output",
  "dist",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "bun.lock",
  "bun.lockb",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

// Conservative protection for dependencies used by source outside registry items.
// oxlint-disable-next-line eslint/max-statements -- Keep validation, ownership checks and updates in their ordered operation so failure boundaries remain explicit.
const sourceUses = async (cwd: string, name: string): Promise<boolean> => {
  const entries = await readdir(cwd, { withFileTypes: true });
  for (const entry of entries) {
    if (ignored.has(entry.name) || entry.name === "package.json") {
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
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process each installation or source entry in order and stop at the first relevant result.
      const content = await readFile(file);
      if (content.includes(name)) {
        return true;
      }
    }
  }
  return false;
};

// oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function -- Keep validation, ownership checks and updates in their ordered operation so failure boundaries remain explicit. Keep this installation operation and its rollback or test assertions together.
export const prepareDependencyUpdate = async (
  cwd: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TypeScript/compiler and registry APIs expose mutable library types; this boundary only reads them.
  plan: Pick<
    Awaited<ReturnType<typeof planInstallation>>,
    "items" | "replacements" | "providerChanges"
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
        manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
      if (
        typeof version === "string" &&
        typeof before.dependencies?.[name] !== "string" &&
        typeof before.devDependencies?.[name] !== "string"
      ) {
        receipt.owned[name] = version;
      }
    }
    for (const [name, installedVersion] of Object.entries(receipt.owned)) {
      const group =
        typeof manifest.dependencies?.[name] === "string"
          ? manifest.dependencies
          : manifest.devDependencies;
      if (
        !required.has(name) &&
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
