#!/usr/bin/env bun
import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import rootLintBaseline from "../oxlint-baseline.json";
import { vendorThreadPackage } from "../packages/cli/src/helpers/vendor-thread-package";
import { collectSnapshot } from "./sync-template-snapshot";

const { join, relative, resolve, sep } = path;
const rootDir = resolve(import.meta.dir, "..");
const isCheck = process.argv.includes("--check");
const rootPackageJsonPath = join(rootDir, "package.json");

// --- chat-app ---
const sourceDir = join(rootDir, "apps", "chat");
const templateDir = join(rootDir, "packages", "cli", "templates", "chat-app");

// --- electron ---
const electronSourceDir = join(rootDir, "apps", "electron");
const electronTemplateDir = join(
  rootDir,
  "packages",
  "cli",
  "templates",
  "electron"
);

// ─── chat-app filter ────────────────────────────────────────────────────────

const EXCLUDED_SEGMENTS = new Set([
  ".devtools",
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

const shouldCopyFilePath = (filePath: string): boolean => {
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
};

// ─── electron filter ─────────────────────────────────────────────────────────

const ELECTRON_EXCLUDED_SEGMENTS = new Set([
  "node_modules",
  ".turbo",
  "build",
  "dist",
  "release",
]);

const ELECTRON_EXCLUDED_FILES = new Set([
  ".DS_Store",
  "bun.lock",
  "bun.lockb",
  "branding.json",
]);

const shouldCopyElectronFilePath = (filePath: string): boolean => {
  const rel = relative(electronSourceDir, filePath);
  if (!rel || rel.startsWith("..")) {
    return true;
  }
  const segments = rel.split(sep);
  if (segments.some((segment) => ELECTRON_EXCLUDED_SEGMENTS.has(segment))) {
    return false;
  }
  const fileName = segments.at(-1);
  if (fileName && ELECTRON_EXCLUDED_FILES.has(fileName)) {
    return false;
  }
  return true;
};

/** Files removed from the template after copying (relative to destination). */
const TEMPLATE_REMOVED_FILES = [
  "components/github-link.tsx",
  "components/docs-link.tsx",
  // This reference-app test requires both built-in tools, which scaffolds may omit.
  "components/part/tool-part.test.tsx",
];

/** Import lines stripped from template files after copying. */
const TEMPLATE_STRIPPED_IMPORTS = [
  'import { DocsLink } from "@/components/docs-link";',
  'import { GitHubLink } from "@/components/github-link";',
];

const applyTemplateTransforms = async (destination: string): Promise<void> => {
  // Delete excluded files
  await Promise.all(
    TEMPLATE_REMOVED_FILES.map((file) =>
      rm(join(destination, file), { force: true })
    )
  );

  // Strip imports that reference removed files
  if (TEMPLATE_STRIPPED_IMPORTS.length > 0) {
    const headerPath = join(destination, "components", "header-actions.tsx");
    let content = await readFile(headerPath, "utf-8");
    for (const imp of TEMPLATE_STRIPPED_IMPORTS) {
      content = content.replace(`${imp}\n`, "");
    }
    // Remove JSX usage of the stripped components
    content = content.replaceAll(/\s*<DocsLink \/>/gu, "");
    content = content.replaceAll(/\s*<GitHubLink \/>/gu, "");
    await writeFile(headerPath, content);
  }

  // Replace monorepo-aware @source paths with single-app path in globals.css
  const globalsCssPath = join(destination, "app", "globals.css");
  let globalsCss = await readFile(globalsCssPath, "utf-8");
  globalsCss = globalsCss.replace(
    /@source "\.\.\/node_modules\/streamdown\/dist\/\*\.js";\n@source "\.\.\/\.\.\/\.\.\/node_modules\/streamdown\/dist\/\*\.js";/u,
    '@source "../node_modules/streamdown/dist/*.js";'
  );
  await writeFile(globalsCssPath, globalsCss);

  await vendorThreadPackage({
    destination,
    threadSourceDir: join(rootDir, "packages", "thread", "src"),
  });

  // Preserve file-scoped exceptions when workspace source is copied into a scaffold.
  const baselinePath = join(destination, "oxlint-baseline.json");
  const baseline = JSON.parse(
    await readFile(baselinePath, "utf-8")
  ) as typeof rootLintBaseline;
  const sourcePaths = [
    ["packages/thread/src/", "lib/thread/"],
    ["apps/electron/", "electron/"],
    ["packages/registry/src/tools/", "tools/chatjs/"],
  ];
  for (const override of rootLintBaseline.overrides) {
    const files = override.files.flatMap((file) =>
      sourcePaths.flatMap(([source, target]) =>
        file.startsWith(source) ? [target + file.slice(source.length)] : []
      )
    );
    if (files.length > 0) {
      baseline.overrides.push({ files, rules: override.rules });
    }
  }
  await writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);

  // Stamp the template with the monorepo-controlled Bun version at build time.
  const rootPackageJson = JSON.parse(
    await readFile(rootPackageJsonPath, "utf-8")
  ) as { packageManager?: string };
  const packageJsonPath = join(destination, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8")) as {
    packageManager?: string;
  };
  packageJson.packageManager = rootPackageJson.packageManager;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
};

const applyElectronTemplateTransforms = async (
  destination: string
): Promise<void> => {
  // tsconfig.json: rewrite monorepo-specific @/ alias to single-app path
  const tsconfigPath = join(destination, "tsconfig.json");
  let tsconfig = await readFile(tsconfigPath, "utf-8");
  tsconfig = tsconfig.replace(/"\.\.\/chat\/\*"/u, '"../*"');
  await writeFile(tsconfigPath, tsconfig);

  // package.json: replace hardcoded package name and repository
  const packageJsonPath = join(destination, "package.json");
  let packageJson = await readFile(packageJsonPath, "utf-8");
  packageJson = packageJson.replace(
    /"name": "@chat-js\/electron"/u,
    '"name": "__PROJECT_NAME__-electron"'
  );
  packageJson = packageJson.replace(
    /"url": "https:\/\/github.com\/FranciscoMoretti\/chat-js.git"/u,
    '"url": "https://github.com/__GITHUB_OWNER__/__GITHUB_REPO__.git"'
  );
  await writeFile(packageJsonPath, packageJson);
};

const copyElectronTemplate = async (destination: string): Promise<void> => {
  await rm(destination, { force: true, recursive: true });
  await cp(electronSourceDir, destination, {
    filter: shouldCopyElectronFilePath,
    recursive: true,
  });
  await applyElectronTemplateTransforms(destination);
};

const copyTemplate = async (destination: string): Promise<void> => {
  await rm(destination, { force: true, recursive: true });
  await cp(sourceDir, destination, {
    filter: shouldCopyFilePath,
    recursive: true,
  });
  await applyTemplateTransforms(destination);
};

const assertSynced = async (
  label: string,
  actualDir: string,
  copyFn: (dest: string) => Promise<void>
): Promise<boolean> => {
  const templateStats = await stat(actualDir).catch(() => null);
  if (!templateStats?.isDirectory()) {
    console.error(
      `${label}: template folder missing. Run \`bun template:sync\`.`
    );
    return false;
  }

  const tempParent = await mkdtemp(join(tmpdir(), "chat-template-"));
  const tempDir = join(tempParent, label);
  await copyFn(tempDir);

  const [expectedSnapshot, actualSnapshot] = await Promise.all([
    collectSnapshot(tempDir),
    collectSnapshot(actualDir),
  ]);

  await rm(tempParent, { force: true, recursive: true });

  const expectedEntries = [...expectedSnapshot.entries()].toSorted((a, b) =>
    a[0].localeCompare(b[0])
  );
  const actualEntries = [...actualSnapshot.entries()].toSorted((a, b) =>
    a[0].localeCompare(b[0])
  );

  if (JSON.stringify(expectedEntries) !== JSON.stringify(actualEntries)) {
    console.error(
      `${label}: template drift detected. Run \`bun template:sync\`.`
    );
    return false;
  }
  console.log(`${label}: template is synced.`);
  return true;
};

if (isCheck) {
  const results = await Promise.all([
    assertSynced("chat-app", templateDir, copyTemplate),
    assertSynced("electron", electronTemplateDir, copyElectronTemplate),
  ]);
  if (results.some((ok) => !ok)) {
    process.exit(1);
  }
} else {
  await copyTemplate(templateDir);
  console.log("Synced templates/chat-app from apps/chat.");
  await copyElectronTemplate(electronTemplateDir);
  console.log("Synced templates/electron from apps/electron.");
}
