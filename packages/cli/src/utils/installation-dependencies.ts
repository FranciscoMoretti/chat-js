import { readFile, readdir, stat, writeFile } from "node:fs/promises";

import type { ReadonlyInput } from "#cli/helpers/readonly-input";
import path from "node:path";

import type { planInstallation } from "./installation-plan";

import { z } from "zod";
import { preflight } from "./preflight";

const dependencyReceipt = "chatjs/installed-dependencies.json";
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

// Conservative protection for dependencies used by source outside registry items.
const protectSourceDependencies = async (
  cwd: string,
  unused: Set<string>,
  root: string = cwd
): Promise<void> => {
  const entries = await readdir(cwd, { withFileTypes: true });
  for (const entry of entries) {
    if (
      ignored.has(entry.name) ||
      (path.relative(root, cwd) === "chatjs" && entry.name !== "generated") ||
      entry.name === "package.json" ||
      entry.name.endsWith(".tsbuildinfo") ||
      (entry.isFile() &&
        binaryAssets.has(path.extname(entry.name).toLowerCase()))
    ) {
      continue;
    }
    if (entry.isSymbolicLink()) {
      // Unknown source behind a symlink cannot prove a dependency is unused.
      unused.clear();
      return;
    }
    const file = path.join(cwd, entry.name);
    if (entry.isDirectory()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Stop scanning once every candidate is protected by usage or unknown source; later unreadable files must not invalidate that conservative result.
      await protectSourceDependencies(file, unused, root);
    } else if (entry.isFile()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Bound memory before reading each user-authored file.
      const metadata = await stat(file);
      if (metadata.size > maxSourceBytes) {
        // Unknown oversized source cannot prove that a dependency is unused.
        unused.clear();
        return;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Read only after the size check and release each buffer before the next file; arbitrary user trees must not load every source file at once.
      const content = await readFile(file);
      for (const name of unused) {
        if (content.includes(name)) {
          unused.delete(name);
        }
      }
    }
    if (unused.size === 0) {
      return;
    }
  }
};
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
      .safeParse(item.meta?.chatjs);
    const key = descriptor.success
      ? `${descriptor.data.kind}:${descriptor.data.id}`
      : `item:${item.name}`;
    receipt.items[key] = [
      ...(item.dependencies ?? []),
      ...(item.devDependencies ?? []),
    ].map((specifier) => dependencyName(specifier));
  }
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
    const candidates = new Map<string, Record<string, string>>();
    for (const [name, installedVersion] of Object.entries(receipt.owned)) {
      const group =
        typeof manifest.dependencies?.[name] === "string"
          ? manifest.dependencies
          : manifest.devDependencies;
      if (!required.has(name) && group && group[name] === installedVersion) {
        candidates.set(name, group);
      }
    }
    const unused = new Set(candidates.keys());
    if (unused.size > 0) {
      await protectSourceDependencies(cwd, unused);
    }
    for (const name of unused) {
      const group = candidates.get(name);
      if (group) {
        Reflect.deleteProperty(group, name);
        Reflect.deleteProperty(receipt.owned, name);
      }
    }
    await writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    await writeFile(
      path.join(cwd, dependencyReceipt),
      `${JSON.stringify(receipt, null, 2)}\n`
    );
  };
};
