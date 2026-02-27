#!/usr/bin/env bun
import { createHash } from "node:crypto";
import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

const rootDir = resolve(import.meta.dir, "..");
const sourceDir = join(rootDir, "apps", "chat");
const templateDir = join(rootDir, "packages", "cli", "templates", "chat-app");
const isCheck = process.argv.includes("--check");

const EXCLUDED_SEGMENTS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "playwright",
  "playwright-report",
  "test-results",
  "blob-report",
  "dist",
  "build",
]);

const EXCLUDED_FILES = new Set([
  ".env.local",
  ".DS_Store",
  "bun.lock",
  "bun.lockb",
]);

function shouldCopyFilePath(filePath: string): boolean {
  const rel = relative(sourceDir, filePath);
  if (!rel || rel.startsWith("..")) {
    return true;
  }
  const segments = rel.split(sep);
  if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) {
    return false;
  }
  const fileName = segments.at(-1);
  if (fileName && EXCLUDED_FILES.has(fileName)) {
    return false;
  }
  return true;
}

/** Files removed from the template after copying (relative to destination). */
const TEMPLATE_REMOVED_FILES = ["components/github-link.tsx"];

/** Import lines stripped from template files after copying. */
const TEMPLATE_STRIPPED_IMPORTS = [
  'import { GitHubLink } from "@/components/github-link";',
];

async function applyTemplateTransforms(destination: string): Promise<void> {
  // Delete excluded files
  await Promise.all(
    TEMPLATE_REMOVED_FILES.map((file) =>
      rm(join(destination, file), { force: true })
    )
  );

  // Strip imports that reference removed files
  if (TEMPLATE_STRIPPED_IMPORTS.length > 0) {
    const headerPath = join(destination, "components", "header-actions.tsx");
    let content = await readFile(headerPath, "utf8");
    for (const imp of TEMPLATE_STRIPPED_IMPORTS) {
      content = content.replace(`${imp}\n`, "");
    }
    // Remove JSX usage of the stripped component
    content = content.replace(/\s*<GitHubLink \/>/g, "");
    await writeFile(headerPath, content);
  }

  // Replace monorepo-aware @source paths with single-app path in globals.css
  const globalsCssPath = join(destination, "app", "globals.css");
  let globalsCss = await readFile(globalsCssPath, "utf8");
  globalsCss = globalsCss.replace(
    /@source "\.\.\/node_modules\/streamdown\/dist\/\*\.js";\n@source "\.\.\/\.\.\/\.\.\/node_modules\/streamdown\/dist\/\*\.js";/,
    '@source "../node_modules/streamdown/dist/*.js";'
  );
  await writeFile(globalsCssPath, globalsCss);
}

async function copyTemplate(destination: string): Promise<void> {
  await rm(destination, { recursive: true, force: true });
  await cp(sourceDir, destination, {
    recursive: true,
    filter: shouldCopyFilePath,
  });
  await applyTemplateTransforms(destination);
}

async function collectSnapshot(
  dir: string,
  prefix = ""
): Promise<Map<string, string>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const output = new Map<string, string>();
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const nested = await collectSnapshot(absolute, rel);
      for (const [nestedPath, hash] of nested) {
        output.set(nestedPath, hash);
      }
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const bytes = await readFile(absolute);
    const hash = createHash("sha256").update(bytes).digest("hex");
    output.set(rel, hash);
  }
  return output;
}

async function assertTemplateSynced(): Promise<void> {
  const templateStats = await stat(templateDir).catch(() => null);
  if (!templateStats?.isDirectory()) {
    console.error("Template folder missing. Run `bun template:sync`.");
    process.exit(1);
  }

  const tempParent = await mkdtemp(join(tmpdir(), "chat-template-"));
  const tempTemplateDir = join(tempParent, "chat-app");
  await copyTemplate(tempTemplateDir);

  const [expectedSnapshot, actualSnapshot] = await Promise.all([
    collectSnapshot(tempTemplateDir),
    collectSnapshot(templateDir),
  ]);

  await rm(tempParent, { recursive: true, force: true });

  const expectedEntries = [...expectedSnapshot.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const actualEntries = [...actualSnapshot.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  if (JSON.stringify(expectedEntries) !== JSON.stringify(actualEntries)) {
    console.error("Template drift detected. Run `bun template:sync`.");
    process.exit(1);
  }
  console.log("Template is synced.");
}

if (isCheck) {
  await assertTemplateSynced();
} else {
  await copyTemplate(templateDir);
  console.log("Synced templates/chat-app from apps/chat.");
}
