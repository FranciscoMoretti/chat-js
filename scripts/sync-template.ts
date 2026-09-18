#!/usr/bin/env bun
import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import rootLintBaseline from "../oxlint-baseline.json";
import { resolvePackageDirectory } from "../packages/cli/src/helpers/resolve-package-directory";
import {
  shouldCopyChatAppFile,
  shouldCopyElectronFile,
  normalizeScaffoldContent,
} from "../packages/cli/src/helpers/scaffold-content";
import { vendorPatchedPackage } from "../packages/cli/src/helpers/vendor-patched-package";
import { collectSnapshot } from "./sync-template-snapshot";

const { join, relative, resolve } = path;
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

const shouldCopyFilePath = (filePath: string): boolean =>
  shouldCopyChatAppFile(relative(sourceDir, filePath));

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
  await normalizeScaffoldContent(destination);

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

  // Preserve file-scoped exceptions when workspace source is copied into a scaffold.
  const baselinePath = join(destination, "oxlint-baseline.json");
  const baseline = JSON.parse(
    await readFile(baselinePath, "utf-8")
  ) as typeof rootLintBaseline;
  const sourcePaths = [
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

  await vendorPatchedPackage({
    destination,
    packageDir: await resolvePackageDirectory("eve", sourceDir),
    packageName: "eve",
    patchPath: join(rootDir, "patches", "eve@0.61.0.patch"),
  });
  await vendorPatchedPackage({
    destination,
    packageDir: await resolvePackageDirectory("@ai-sdk/mcp", sourceDir),
    packageName: "@ai-sdk/mcp",
    patchPath: join(rootDir, "patches", "ai-sdk-mcp@2.0.52.patch"),
  });
  await vendorPatchedPackage({
    destination,
    packageDir: await resolvePackageDirectory(
      "@workflow/world-postgres",
      sourceDir
    ),
    packageName: "@workflow/world-postgres",
    patchPath: join(
      rootDir,
      "patches",
      "workflow-world-postgres@5.0.0-beta.40.patch"
    ),
  });

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
    filter: (file) => shouldCopyElectronFile(relative(electronSourceDir, file)),
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
