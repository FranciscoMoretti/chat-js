#!/usr/bin/env bun
import { cp, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/* oxlint-disable import/no-relative-parent-imports -- the ../packages/cli/src/helpers/resolve-package-directory import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import { resolvePackageDirectory } from "../packages/cli/src/helpers/resolve-package-directory";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- the ../packages/cli/src/helpers/scaffold-content import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import {
  shouldCopyChatAppFile,
  shouldCopyElectronFile,
  normalizeScaffoldContent,
} from "../packages/cli/src/helpers/scaffold-content";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- the ../packages/cli/src/helpers/vendor-patched-package import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import { vendorPatchedPackage } from "../packages/cli/src/helpers/vendor-patched-package";
/* oxlint-enable import/no-relative-parent-imports */
import { collectSnapshot } from "./sync-template-snapshot";

const join = (...segments: readonly string[]): string => path.join(...segments);
const relative = (from: string, to: string): string => path.relative(from, to);
const resolve = (...segments: readonly string[]): string =>
  path.resolve(...segments);
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
];

/** Import lines stripped from template files after copying. */
const TEMPLATE_STRIPPED_IMPORTS = [
  'import { DocsLink } from "@/components/docs-link";',
  'import { GitHubLink } from "@/components/github-link";',
];

/* oxlint-disable eslint/max-statements -- applyTemplateTransforms: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/max-lines-per-function -- applyTemplateTransforms: The operation keeps its validation, ordered side effects and cleanup in one scope. */
/* oxlint-disable eslint/no-magic-numbers -- applyTemplateTransforms: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable unicorn/no-null -- applyTemplateTransforms: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable typescript/promise-function-async -- applyTemplateTransforms: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
const applyTemplateTransforms = async (destination: string): Promise<void> => {
  await normalizeScaffoldContent(destination);

  // Delete excluded files
  await Promise.all(
    TEMPLATE_REMOVED_FILES.map((file): Promise<void> =>
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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- These repository-owned package manifests use the packageManager string contract; retain all unrelated JSON fields.
  const rootPackageJson = JSON.parse(
    await readFile(rootPackageJsonPath, "utf-8")
  ) as { packageManager?: string };
  const packageJsonPath = join(destination, "package.json");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The generated template manifest retains arbitrary package fields while stamping the known packageManager field.
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8")) as {
    packageManager?: string;
  };
  packageJson.packageManager = rootPackageJson.packageManager;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
};
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

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

const copyElectronTemplate = async (destination: string): Promise<void> => {
  await rm(destination, { force: true, recursive: true });
  await cp(electronSourceDir, destination, {
    filter: (file): boolean =>
      shouldCopyElectronFile(relative(electronSourceDir, file)),
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

/* oxlint-disable eslint/max-statements -- assertSynced: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable unicorn/no-null -- assertSynced: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable eslint/no-console -- assertSynced: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable eslint/no-magic-numbers -- assertSynced: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable typescript/strict-boolean-expressions -- assertSynced: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- assertSynced: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
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

  const expectedEntries = [...expectedSnapshot.entries()].toSorted(
    (leftEntry, rightEntry): number => leftEntry[0].localeCompare(rightEntry[0])
  );
  const actualEntries = [...actualSnapshot.entries()].toSorted(
    (leftEntry, rightEntry): number => leftEntry[0].localeCompare(rightEntry[0])
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-console */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-magic-numbers -- sync-template.ts: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable eslint/no-console -- sync-template.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
if (isCheck) {
  const results = await Promise.all([
    assertSynced("chat-app", templateDir, copyTemplate),
    assertSynced("electron", electronTemplateDir, copyElectronTemplate),
  ]);
  if (results.some((ok): boolean => !ok)) {
    process.exit(1);
  }
} else {
  await copyTemplate(templateDir);
  console.log("Synced templates/chat-app from apps/chat.");
  await copyElectronTemplate(electronTemplateDir);
  console.log("Synced templates/electron from apps/electron.");
}
/* oxlint-enable eslint/no-console */
/* oxlint-enable eslint/no-magic-numbers */
