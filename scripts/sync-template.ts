#!/usr/bin/env bun
// oxlint-disable-next-line import/no-nodejs-modules -- The template synchronizer reads and copies repository files through native filesystem APIs.
import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
/* oxlint-disable import/no-relative-parent-imports -- the ../packages/cli/src/helpers/scaffold-content import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import {
  normalizeScaffoldContent,
  shouldCopyChatAppFile,
  shouldCopyElectronFile,
} from "../packages/cli/src/helpers/scaffold-content";
/* oxlint-enable import/no-relative-parent-imports */
import { collectSnapshot } from "./sync-template-snapshot";
// oxlint-disable-next-line import/no-relative-parent-imports -- Template generation reuses the canonical CLI JSON object reader.
import { parseJsonObject } from "../packages/cli/src/helpers/json-object";
// oxlint-disable-next-line import/no-relative-parent-imports -- Template generation reuses the canonical CLI package manifest validator.
import { parsePackageJson } from "../packages/cli/src/helpers/package-manifest";
// oxlint-disable-next-line import/no-nodejs-modules -- The template synchronizer creates temporary directories and copies canonical repository files.
import path from "node:path";
/* oxlint-disable import/no-relative-parent-imports -- the ../packages/cli/src/helpers/resolve-package-directory import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import { resolvePackageDirectory } from "../packages/cli/src/helpers/resolve-package-directory";
/* oxlint-enable import/no-relative-parent-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- The template synchronizer creates temporary directories and copies canonical repository files.
import { tmpdir } from "node:os";
/* oxlint-disable import/no-relative-parent-imports -- the ../packages/cli/src/helpers/vendor-patched-package import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import { vendorPatchedPackage } from "../packages/cli/src/helpers/vendor-patched-package";
/* oxlint-enable import/no-relative-parent-imports */

const join = (...segments: readonly string[]): string => path.join(...segments);
const relative = (from: string, to: string): string => path.relative(from, to);
const resolve = (...segments: readonly string[]): string =>
  path.resolve(...segments);
const MANIFEST_INDENT_SPACES = 2;
const EMPTY_IMPORT_LIST_LENGTH = 0;
const FAILURE_EXIT_STATUS = 1;
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
  // This test covers the reference app's Vercel adapter; scaffolds select their own.
  "lib/storage-provider.test.ts",
  // This contract test imports canonical registry source outside a generated app.
  "lib/eve/daytona-code-executor.test.ts",
];

/** Import lines stripped from template files after copying. */
const TEMPLATE_STRIPPED_IMPORTS = [
  'import { DocsLink } from "@/components/docs-link";',
  'import { GitHubLink } from "@/components/github-link";',
];

/* oxlint-disable oxc/no-async-await -- Preserve removeTemplateReferences filesystem sequencing and rejected-Promise behavior in the Bun template command. */
const removeTemplateReferences = async (destination: string): Promise<void> => {
  // Delete excluded files
  await Promise.all(
    TEMPLATE_REMOVED_FILES.map(
      async (file): Promise<void> =>
        await rm(join(destination, file), { force: true })
    )
  );

  // Strip imports that reference removed files
  if (TEMPLATE_STRIPPED_IMPORTS.length > EMPTY_IMPORT_LIST_LENGTH) {
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
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Preserve rewriteTemplateStyles filesystem sequencing and rejected-Promise behavior in the Bun template command. */
const rewriteTemplateStyles = async (destination: string): Promise<void> => {
  // Replace monorepo-aware @source paths with single-app path in globals.css
  const globalsCssPath = join(destination, "app", "globals.css");
  let globalsCss = await readFile(globalsCssPath, "utf-8");
  globalsCss = globalsCss.replace(
    /@source "\.\.\/node_modules\/streamdown\/dist\/\*\.js";\n@source "\.\.\/\.\.\/\.\.\/node_modules\/streamdown\/dist\/\*\.js";/u,
    '@source "../node_modules/streamdown/dist/*.js";'
  );
  await writeFile(globalsCssPath, globalsCss);
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Preserve stampTemplateManifest filesystem sequencing and rejected-Promise behavior in the Bun template command. */
const stampTemplateManifest = async (destination: string): Promise<void> => {
  const rootPackageJson = parsePackageJson(
    await readFile(rootPackageJsonPath, "utf-8")
  );
  const packageJsonPath = join(destination, "package.json");
  const packageJson = parseJsonObject(
    await readFile(packageJsonPath, "utf-8"),
    "Template package.json"
  );
  packageJson.packageManager = rootPackageJson.packageManager;
  await writeFile(
    packageJsonPath,
    // oxlint-disable-next-line unicorn/no-null -- Use the native unfiltered JSON serializer for the stamped manifest.
    `${JSON.stringify(packageJson, null, MANIFEST_INDENT_SPACES)}\n`
  );
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Preserve applyTemplateTransforms filesystem sequencing and rejected-Promise behavior in the Bun template command. */
const applyTemplateTransforms = async (destination: string): Promise<void> => {
  await normalizeScaffoldContent(destination);
  await removeTemplateReferences(destination);
  await rewriteTemplateStyles(destination);
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

  await stampTemplateManifest(destination);
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve applyElectronTemplateTransforms's awaited sequencing and rejected-Promise behavior. */

const applyElectronTemplateTransforms = async (
  destination: string
): Promise<void> => {
  // Rewrite the monorepo alias and ambient declaration paths for the single-app layout.
  const tsconfigPath = join(destination, "tsconfig.json");
  let tsconfig = await readFile(tsconfigPath, "utf-8");
  tsconfig = tsconfig.replace(/"\.\.\/chat\/\*"/u, '"../*"');
  tsconfig = tsconfig
    .replace('"../chat/next-env.d.ts"', '"../next-env.d.ts"')
    .replace('"../chat/electron.d.ts"', '"../electron.d.ts"');
  await writeFile(tsconfigPath, tsconfig);

  // The package.json transform replaces the hardcoded package name and repository.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve copyElectronTemplate's awaited sequencing and rejected-Promise behavior. */
const copyElectronTemplate = async (destination: string): Promise<void> => {
  await rm(destination, { force: true, recursive: true });
  await cp(electronSourceDir, destination, {
    filter: (file): boolean =>
      shouldCopyElectronFile(relative(electronSourceDir, file)),
    recursive: true,
  });
  await applyElectronTemplateTransforms(destination);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve copyTemplate's awaited sequencing and rejected-Promise behavior. */
const copyTemplate = async (destination: string): Promise<void> => {
  await rm(destination, { force: true, recursive: true });
  await cp(sourceDir, destination, {
    filter: shouldCopyFilePath,
    recursive: true,
  });
  await applyTemplateTransforms(destination);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable eslint/no-console -- Template parity reports preserve the command's operator-facing stdout and stderr channels. */
const reportSnapshotParity = (
  label: string,
  expectedSnapshot: Readonly<Pick<Map<string, string>, "entries">>,
  actualSnapshot: Readonly<Pick<Map<string, string>, "entries">>
): boolean => {
  const expectedEntries = [...expectedSnapshot.entries()].toSorted(
    (
      [leftPath]: readonly [string, string],
      [rightPath]: readonly [string, string]
    ): number => leftPath.localeCompare(rightPath)
  );
  const actualEntries = [...actualSnapshot.entries()].toSorted(
    (
      [leftPath]: readonly [string, string],
      [rightPath]: readonly [string, string]
    ): number => leftPath.localeCompare(rightPath)
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assertSynced's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable unicorn/no-null -- assertSynced: The SDK/wire/OS contract uses null as an explicit absence value. */
const assertSynced = async (
  label: string,
  actualDir: string,
  copyFn: (dest: string) => Promise<void>
): Promise<boolean> => {
  const templateStats = await stat(actualDir).catch(() => null);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading isDirectory from templateStats; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  if (templateStats?.isDirectory() !== true) {
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

  return reportSnapshotParity(label, expectedSnapshot, actualSnapshot);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-console */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable eslint/no-console -- sync-template.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
if (isCheck) {
  // oxlint-disable-next-line node/no-top-level-await -- This Bun command awaits both template comparisons before setting its check exit status.
  const results = await Promise.all([
    assertSynced("chat-app", templateDir, copyTemplate),
    assertSynced("electron", electronTemplateDir, copyElectronTemplate),
  ]);
  if (results.some((ok): boolean => !ok)) {
    process.exit(FAILURE_EXIT_STATUS);
  }
} else {
  // oxlint-disable-next-line node/no-top-level-await -- This Bun command completes chat template copying before reporting synchronization.
  await copyTemplate(templateDir);
  console.log("Synced templates/chat-app from apps/chat.");
  // oxlint-disable-next-line node/no-top-level-await -- This Bun command completes Electron template copying before reporting synchronization.
  await copyElectronTemplate(electronTemplateDir);
  console.log("Synced templates/electron from apps/electron.");
}
/* oxlint-enable eslint/no-console */
