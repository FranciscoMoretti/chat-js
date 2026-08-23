import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageManager } from "../types";
import { normalizeScaffoldedPackageJson } from "./package-manifest";
import {
  configureStorageProvider,
  type StorageSelection,
} from "./storage-provider";
import {
  createEmptyToolsTemplate,
  createEmptyUiTemplate,
} from "../utils/inject-tool";
import { runCommand } from "../utils/run-command";
import { vendorThreadPackage } from "./vendor-thread-package";

const CHAT_APP_EXCLUDED_SEGMENTS = new Set([
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

const CHAT_APP_EXCLUDED_FILES = new Set([
  ".env.local",
  ".DS_Store",
  "bun.lock",
  "bun.lockb",
]);

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

const PNPM_BUILD_SCRIPT_ALLOWLIST = [
  "better-sqlite3",
  "electron",
  "electron-winstaller",
  "esbuild",
  "fs-xattr",
  "macos-alias",
  "sharp",
] as const;

function getCliPackageRoot(): string {
  const __dir = dirname(fileURLToPath(import.meta.url));

  for (const relative of ["..", "../.."]) {
    const candidate = resolve(__dir, relative);
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
  }

  throw new Error("Could not locate the @chat-js/cli package root.");
}

function getRepoRoot(): string {
  return resolve(getCliPackageRoot(), "../..");
}

function findTemplateDir(name: string): string | null {
  const cliRoot = getCliPackageRoot();
  const candidate = join(cliRoot, "templates", name);
  return existsSync(candidate) ? candidate : null;
}

function shouldCopyChatAppFilePath(sourceDir: string, filePath: string): boolean {
  const relativePath = relative(sourceDir, filePath);
  const segments = relativePath.split(sep);
  if (segments.some((segment) => CHAT_APP_EXCLUDED_SEGMENTS.has(segment))) {
    return false;
  }
  const fileName = segments.at(-1);
  return !(fileName && CHAT_APP_EXCLUDED_FILES.has(fileName));
}

function shouldCopyElectronFilePath(
  sourceDir: string,
  filePath: string
): boolean {
  const relativePath = relative(sourceDir, filePath);
  const segments = relativePath.split(sep);
  if (segments.some((segment) => ELECTRON_EXCLUDED_SEGMENTS.has(segment))) {
    return false;
  }
  const fileName = segments.at(-1);
  return !(fileName && ELECTRON_EXCLUDED_FILES.has(fileName));
}

function runScript(packageManager: PackageManager, script: string): string {
  return `${packageManager} run ${script}`;
}

function execCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case "bun":
      return "bunx";
    case "pnpm":
      return "pnpm dlx";
    case "yarn":
      return "yarn dlx";
    case "npm":
      return "npx";
  }
}

async function replaceInFile(
  filePath: string,
  replacements: Array<[string, string]>
): Promise<void> {
  if (!existsSync(filePath)) {
    return;
  }
  let content = await readFile(filePath, "utf8");
  for (const [search, replacement] of replacements) {
    content = content.replaceAll(search, replacement);
  }
  await writeFile(filePath, content);
}

async function resetInstallableTools(destination: string): Promise<void> {
  const toolsDir = join(destination, "tools", "chatjs");
  await rm(toolsDir, { recursive: true, force: true });
  await mkdir(toolsDir, { recursive: true });
  await writeFile(join(toolsDir, "tools.ts"), createEmptyToolsTemplate());
  await writeFile(join(toolsDir, "ui.ts"), createEmptyUiTemplate());
}

async function writePnpmWorkspaceConfig(
  destination: string,
  options?: { blockExoticSubdeps?: boolean }
): Promise<void> {
  const packageLines = ["packages:", "  - ."];
  const pnpm10Lines = [
    "onlyBuiltDependencies:",
    ...PNPM_BUILD_SCRIPT_ALLOWLIST.map((name) => `  - ${name}`),
  ];
  const pnpm11Lines = [
    "allowBuilds:",
    ...PNPM_BUILD_SCRIPT_ALLOWLIST.map((name) => `  ${name}: true`),
  ];
  const supplyChainLines =
    typeof options?.blockExoticSubdeps === "boolean"
      ? [`blockExoticSubdeps: ${options.blockExoticSubdeps}`]
      : [];

  await writeFile(
    join(destination, "pnpm-workspace.yaml"),
    `${[
      ...packageLines,
      ...pnpm10Lines,
      ...pnpm11Lines,
      ...supplyChainLines,
    ].join("\n")}\n`,
  );
}

async function applyChatTemplateSourceTransforms(
  destination: string
): Promise<void> {
  await Promise.all(
    ["components/github-link.tsx", "components/docs-link.tsx"].map((file) =>
      rm(join(destination, file), { force: true })
    )
  );

  const headerPath = join(destination, "components", "header-actions.tsx");
  await replaceInFile(headerPath, [
    ['import { DocsLink } from "@/components/docs-link";\n', ""],
    ['import { GitHubLink } from "@/components/github-link";\n', ""],
    ["<DocsLink />", ""],
    ["<GitHubLink />", ""],
  ]);

  const globalsCssPath = join(destination, "app", "globals.css");
  await replaceInFile(globalsCssPath, [
    [
      '@source "../node_modules/streamdown/dist/*.js";\n@source "../../../node_modules/streamdown/dist/*.js";',
      '@source "../node_modules/streamdown/dist/*.js";',
    ],
  ]);

  const repoPackageJsonPath = join(getRepoRoot(), "package.json");
  const rootPackageJson = JSON.parse(
    await readFile(repoPackageJsonPath, "utf8")
  ) as { packageManager?: string };
  const packageJsonPath = join(destination, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    packageManager?: string;
  };
  packageJson.packageManager = rootPackageJson.packageManager;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  await vendorThreadPackage({
    destination,
    threadSourceDir: join(getRepoRoot(), "packages", "thread", "src"),
  });
}

async function applyElectronTemplateSourceTransforms(
  destination: string
): Promise<void> {
  const tsconfigPath = join(destination, "tsconfig.json");
  await replaceInFile(tsconfigPath, [['"../chat/*"', '"../*"']]);

  const packageJsonPath = join(destination, "package.json");
  await replaceInFile(packageJsonPath, [
    ['"name": "@chat-js/electron"', '"name": "__PROJECT_NAME__-electron"'],
    [
      '"url": "https://github.com/FranciscoMoretti/chat-js.git"',
      '"url": "https://github.com/__GITHUB_OWNER__/__GITHUB_REPO__.git"',
    ],
  ]);
}

async function copyChatTemplateFromRepoSource(destination: string): Promise<void> {
  const sourceDir = join(getRepoRoot(), "apps", "chat");
  await cp(sourceDir, destination, {
    recursive: true,
    filter: (filePath) => shouldCopyChatAppFilePath(sourceDir, filePath),
  });
  await applyChatTemplateSourceTransforms(destination);
}

async function copyElectronTemplateFromRepoSource(
  destination: string
): Promise<void> {
  const sourceDir = join(getRepoRoot(), "apps", "electron");
  await cp(sourceDir, destination, {
    recursive: true,
    filter: (filePath) => shouldCopyElectronFilePath(sourceDir, filePath),
  });
  await applyElectronTemplateSourceTransforms(destination);
}

async function normalizeChatAppFiles(
  destination: string,
  packageManager: PackageManager
): Promise<void> {
  await replaceInFile(join(destination, "playwright.config.ts"), [
    ['command: "bun dev"', `command: "${runScript(packageManager, "dev")}"`],
  ]);

  await replaceInFile(join(destination, "scripts", "check-env.ts"), [
    [
      " * Run via `bun run check-env` or automatically in prebuild.",
      ` * Run via \`${runScript(packageManager, "check-env")}\` or automatically in prebuild.`,
    ],
    [
      "bun fetch:models",
      runScript(packageManager, "fetch:models"),
    ],
  ]);

  await replaceInFile(
    join(destination, "lib", "ai", "gateways", "fallback-models.ts"),
    [
      [
        "bun fetch:models",
        runScript(packageManager, "fetch:models"),
      ],
    ]
  );

  await replaceInFile(join(destination, "scripts", "with-db.sh"), [
    ["bunx neonctl", `${execCommand(packageManager)} neonctl`],
    ["filter out bun's package resolution output", `filter out ${execCommand(packageManager)} resolution output`],
    [
      "Run: bun db:branch:use main  (to switch back to main)",
      "Run: bash scripts/db-branch-use.sh main  (to switch back to main)",
    ],
  ]);

  await replaceInFile(join(destination, "scripts", "db-branch-create.sh"), [
    ["bunx neonctl", `${execCommand(packageManager)} neonctl`],
    [
      'echo "To use it: bun db:branch:use $BRANCH_NAME"',
      'echo "To use it: bash scripts/db-branch-use.sh $BRANCH_NAME"',
    ],
  ]);

  await replaceInFile(join(destination, "scripts", "db-branch-use.sh"), [
    ["bunx neonctl", `${execCommand(packageManager)} neonctl`],
    ['echo "Usage: bun db:branch:use <branch-name>"', 'echo "Usage: bash scripts/db-branch-use.sh <branch-name>"'],
    [
      'echo "       bun db:branch:use main  (switch to production)"',
      'echo "       bash scripts/db-branch-use.sh main  (switch to production)"',
    ],
    ['echo "Available branches: bun db:branch:list"', `echo "Available branches: ${execCommand(packageManager)} neonctl branches list"`],
    ['echo "Create branch: bun db:branch:create"', 'echo "Create branch: bash scripts/db-branch-create.sh"'],
  ]);

  await replaceInFile(join(destination, "scripts", "db-branch-delete.sh"), [
    ["bunx neonctl", `${execCommand(packageManager)} neonctl`],
  ]);

  await replaceInFile(join(destination, "scripts", "worktree-setup.sh"), [
    ["bun i", `${packageManager} install`],
  ]);

  const vercelJsonPath = join(destination, "vercel.json");
  const vercelJson = JSON.parse(await readFile(vercelJsonPath, "utf8")) as {
    installCommand?: string;
    buildCommand?: string;
  };
  vercelJson.installCommand = `${packageManager} install`;
  vercelJson.buildCommand = runScript(packageManager, "build");
  await writeFile(vercelJsonPath, `${JSON.stringify(vercelJson, null, 2)}\n`);

  if (packageManager === "pnpm") {
    await writePnpmWorkspaceConfig(destination);
  }

  await resetInstallableTools(destination);
}

async function normalizeElectronFiles(
  destination: string,
  packageManager: PackageManager
): Promise<void> {
  const scriptPlaceholder = "$" + "{script}";

  await replaceInFile(join(destination, "forge.config.ts"), [
    ["Run \\`bun run prebuild\\`", "Run \\`" + runScript(packageManager, "prebuild") + "\\`"],
    ["function runBunScript", "function runPackageManagerScript"],
    ['spawnSync("bun", ["run", script], {', `spawnSync("${packageManager}", ["run", script], {`],
    [`bun run ${scriptPlaceholder} failed`, `${packageManager} run ${scriptPlaceholder} failed`],
    ["  runBunScript(\"prebuild\");", "  runPackageManagerScript(\"prebuild\");"],
    [
      '        runBunScript("build", { NODE_ENV: "development" });',
      '        runPackageManagerScript("build", { NODE_ENV: "development" });',
    ],
    [
      '        runBunScript("build", { NODE_ENV: "production" });',
      '        runPackageManagerScript("build", { NODE_ENV: "production" });',
    ],
  ]);

  await replaceInFile(join(destination, "README.md"), [
    ["bun install", `${packageManager} install`],
    ["bun run dev", runScript(packageManager, "dev")],
    ["bun run generate-icons", runScript(packageManager, "generate-icons")],
    ["bun run make:mac", runScript(packageManager, "make:mac")],
    ["bun run make:win", runScript(packageManager, "make:win")],
    ["bun run make:linux", runScript(packageManager, "make:linux")],
  ]);

  if (packageManager === "pnpm") {
    await writePnpmWorkspaceConfig(destination, { blockExoticSubdeps: false });
  }
}

async function excludeElectronFromRootTypecheck(projectDir: string): Promise<void> {
  const tsconfigPath = join(projectDir, "tsconfig.json");
  const tsconfig = JSON.parse(await readFile(tsconfigPath, "utf8")) as {
    exclude?: string[];
  };

  tsconfig.exclude = Array.from(
    new Set([...(tsconfig.exclude ?? []), "electron"])
  );
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
}

export async function scaffoldFromTemplate(
  destination: string,
  options?: {
    packageManager?: PackageManager;
    storage?: StorageSelection;
  }
): Promise<void> {
  const packageManager = options?.packageManager ?? "bun";
  const templateDir = findTemplateDir("chat-app");

  if (templateDir) {
    await cp(templateDir, destination, { recursive: true });
  } else {
    await copyChatTemplateFromRepoSource(destination);
  }

  const packageJsonPath = join(destination, "package.json");
  const packageJson = normalizeScaffoldedPackageJson(
    JSON.parse(await readFile(packageJsonPath, "utf8")) as Record<string, unknown>,
    {
      packageManager,
      template: "chat-app",
    }
  );
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  await configureStorageProvider(
    destination,
    options?.storage ?? { provider: "vercel-blob", options: {} }
  );
  await normalizeChatAppFiles(destination, packageManager);
}

export async function scaffoldElectron(
  projectDir: string,
  opts: { projectName: string; packageManager?: PackageManager }
): Promise<void> {
  const packageManager = opts.packageManager ?? "bun";
  const rootPackageJsonPath = join(projectDir, "package.json");
  const rootPackageJson = JSON.parse(
    await readFile(rootPackageJsonPath, "utf8")
  ) as {
    devDependencies?: Record<string, string>;
  };
  const destination = join(projectDir, "electron");
  const templateDir = findTemplateDir("electron");

  if (templateDir) {
    await cp(templateDir, destination, { recursive: true });
  } else {
    await copyElectronTemplateFromRepoSource(destination);
  }

  const packageJsonPath = join(destination, "package.json");
  const packageJson = normalizeScaffoldedPackageJson(
    JSON.parse(
      (await readFile(packageJsonPath, "utf8"))
        .replace("__PROJECT_NAME__-electron", `${opts.projectName}-electron`)
        .replace("__GITHUB_OWNER__", "your-github-username")
        .replace("__GITHUB_REPO__", opts.projectName)
    ) as Record<string, unknown>,
    {
      packageManager,
      template: "electron",
      tsxVersion: rootPackageJson.devDependencies?.tsx,
    }
  );
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  await normalizeElectronFiles(destination, packageManager);
  await excludeElectronFromRootTypecheck(projectDir);
}

export async function scaffoldFromGit(
  url: string,
  destination: string,
  options?: { storage?: StorageSelection }
): Promise<void> {
  await runCommand(
    "git",
    ["clone", "--depth", "1", url, destination],
    process.cwd()
  );
  await rm(join(destination, ".git"), { recursive: true, force: true });
  if (!existsSync(join(destination, "lib", "storage-provider.ts"))) {
    return;
  }
  await configureStorageProvider(
    destination,
    options?.storage ?? { provider: "vercel-blob", options: {} }
  );
}
