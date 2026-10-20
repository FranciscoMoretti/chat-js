import { copyDevelopmentSupervisor } from "./copy-development-supervisor";
import {
  access,
  cp,
  mkdir,
  readFile,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import {
  isJsonObject,
  isStringArray,
  parseJsonObject,
  requireJsonObject,
} from "./json-object";
import {
  normalizeScaffoldContent,
  shouldCopyChatAppFile,
  shouldCopyElectronFile,
} from "./scaffold-content";
import {
  normalizeScaffoldedPackageJson,
  parsePackageJson,
} from "./package-manifest";
import type { PackageManager } from "#cli/types";
import { attachmentUploadFiles } from "../../../registry/src/features/attachment-uploads";
import { existsSync } from "node:fs";
import { initializeFeatureUi } from "#cli/utils/sync-features";
import { mcpFiles } from "../../../registry/src/features/mcp";
import pathModule from "node:path";
import { registryUrl } from "#cli/registry/shadcn";
import { resolvePackageDirectory } from "./resolve-package-directory";
import { runCommand } from "#cli/utils/run-command";
import { syncTools } from "#cli/utils/sync-tools";
import { vendorPatchedPackage } from "./vendor-patched-package";

const JSON_INDENTATION_SPACES = 2;

const PNPM_BUILD_SCRIPT_ALLOWLIST = [
  "@mongodb-js/zstd",
  "cbor-extract",
  "electron",
  "electron-winstaller",
  "esbuild",
  "fs-xattr",
  "macos-alias",
  "node-liblzma",
  "sharp",
] as const;

const getCliPackageRoot = (): string => {
  const directory = import.meta.dirname;

  for (const relativePath of ["..", "../.."]) {
    const candidate = pathModule.resolve(directory, relativePath);
    if (existsSync(pathModule.join(candidate, "package.json"))) {
      return candidate;
    }
  }

  throw new Error("Could not locate the @chat-js/cli package root.");
};

const getRepoRoot = (): string =>
  pathModule.resolve(getCliPackageRoot(), "../..");

const findTemplateDir = (name: string): string | null => {
  const cliRoot = getCliPackageRoot();
  const candidate = pathModule.join(cliRoot, "templates", name);
  if (existsSync(candidate)) {
    return candidate;
  }
  return null;
};

const shouldCopyChatAppFilePath = (
  sourceDir: string,
  filePath: string
): boolean => shouldCopyChatAppFile(pathModule.relative(sourceDir, filePath));

const runScript = (packageManager: PackageManager, script: string): string =>
  `${packageManager} run ${script}`;

const replaceInFile = async (
  filePath: string,
  replacements: readonly (readonly [string, string])[]
): Promise<void> => {
  try {
    await access(filePath);
  } catch {
    return;
  }
  let content = await readFile(filePath, "utf-8");
  for (const [search, replacement] of replacements) {
    content = content.replaceAll(search, replacement);
  }
  await writeFile(filePath, content);
};

const normalizeGatewaySnapshotCommands = async (
  destination: string,
  packageManager: PackageManager
): Promise<void> => {
  await replaceInFile(
    pathModule.join(destination, "scripts", "environment-validation-report.ts"),
    [["bun fetch:models", runScript(packageManager, "fetch:models")]]
  );
  await replaceInFile(
    pathModule.join(destination, "scripts", "gateway-snapshot-warning.test.ts"),
    [["bun fetch:models", runScript(packageManager, "fetch:models")]]
  );
  await replaceInFile(
    pathModule.join(destination, "lib", "ai", "gateways", "fallback-models.ts"),
    [["bun fetch:models", runScript(packageManager, "fetch:models")]]
  );
};

const resetInstallableTools = async (destination: string): Promise<void> => {
  const toolsDir = pathModule.join(destination, "tools", "chatjs");
  await rm(toolsDir, { force: true, recursive: true });
  await mkdir(toolsDir, { recursive: true });
  await syncTools(destination);
};
const writePnpmWorkspaceConfig = async (
  destination: string,
  options: { readonly blockExoticSubdeps?: boolean } = {}
): Promise<void> => {
  const packageLines = ["packages:", "  - ."];
  const buildPackages = PNPM_BUILD_SCRIPT_ALLOWLIST.map((name) =>
    name.startsWith("@") ? JSON.stringify(name) : name
  );
  const pnpm10Lines = [
    "onlyBuiltDependencies:",
    ...buildPackages.map((name) => `  - ${name}`),
  ];
  const pnpm11Lines = [
    "allowBuilds:",
    ...buildPackages.map((name) => `  ${name}: true`),
  ];
  let supplyChainLines: string[] = [];
  if (typeof options.blockExoticSubdeps === "boolean") {
    supplyChainLines = [`blockExoticSubdeps: ${options.blockExoticSubdeps}`];
  }

  await writeFile(
    pathModule.join(destination, "pnpm-workspace.yaml"),
    `${[
      ...packageLines,
      ...pnpm10Lines,
      ...pnpm11Lines,
      ...supplyChainLines,
    ].join("\n")}\n`
  );
};
const applyChatTemplateSourceTransforms = async (
  destination: string
): Promise<void> => {
  await copyDevelopmentSupervisor(getRepoRoot(), destination);
  await Promise.all(
    ["components/github-link.tsx", "components/docs-link.tsx"].map(
      async (file): Promise<void> => {
        await rm(pathModule.join(destination, file), { force: true });
      }
    )
  );

  const headerPath = pathModule.join(
    destination,
    "components",
    "header-actions.tsx"
  );
  await replaceInFile(headerPath, [
    ['import { DocsLink } from "@/components/docs-link";\n', ""],
    ['import { GitHubLink } from "@/components/github-link";\n', ""],
    ["<DocsLink />", ""],
    ["<GitHubLink />", ""],
  ]);

  const globalsCssPath = pathModule.join(destination, "app", "globals.css");
  await replaceInFile(globalsCssPath, [
    [
      '@source "../node_modules/streamdown/dist/*.js";\n@source "../../../node_modules/streamdown/dist/*.js";',
      '@source "../node_modules/streamdown/dist/*.js";',
    ],
  ]);

  const repoPackageJsonPath = pathModule.join(getRepoRoot(), "package.json");
  const rootPackageJson = parseJsonObject(
    await readFile(repoPackageJsonPath, "utf-8"),
    "Repository package.json"
  );
  const packageJsonPath = pathModule.join(destination, "package.json");
  const packageJson = parseJsonObject(
    await readFile(packageJsonPath, "utf-8"),
    "Template package.json"
  );
  packageJson.packageManager = rootPackageJson.packageManager;
  await writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, JSON_INDENTATION_SPACES)}\n`
  );

  await vendorPatchedPackage({
    destination,
    packageDir: await resolvePackageDirectory(
      "@workflow/world-postgres",
      pathModule.join(getRepoRoot(), "apps", "chat")
    ),
    packageName: "@workflow/world-postgres",
    patchPath: pathModule.join(
      getRepoRoot(),
      "patches",
      "workflow-world-postgres@5.0.0-beta.40.patch"
    ),
  });
  await vendorPatchedPackage({
    destination,
    dependencyName: "eve",
    packageDir: await resolvePackageDirectory(
      "eve",
      pathModule.join(getRepoRoot(), "apps", "chat"),
      "@chat-js/eve"
    ),
    packageName: "@chat-js/eve",
    patchPath: pathModule.join(
      getRepoRoot(),
      "patches",
      "@chat-js%2Feve@0.80.1-chatjs.2.patch"
    ),
  });
};

const applyElectronTemplateSourceTransforms = async (
  destination: string
): Promise<void> => {
  const tsconfigPath = pathModule.join(destination, "tsconfig.json");
  await replaceInFile(tsconfigPath, [
    ['"../chat/*"', '"../*"'],
    ['"../chat/next-env.d.ts"', '"../next-env.d.ts"'],
    ['"../chat/electron.d.ts"', '"../electron.d.ts"'],
  ]);

  const packageJsonPath = pathModule.join(destination, "package.json");
  await replaceInFile(packageJsonPath, [
    ['"name": "@chat-js/electron"', '"name": "__PROJECT_NAME__-electron"'],
    [
      '"url": "https://github.com/FranciscoMoretti/chat-js.git"',
      '"url": "https://github.com/__GITHUB_OWNER__/__GITHUB_REPO__.git"',
    ],
  ]);
};
const copyChatTemplateFromRepoSource = async (
  destination: string
): Promise<void> => {
  const sourceDir = pathModule.join(getRepoRoot(), "apps", "chat");
  await cp(sourceDir, destination, {
    filter: (filePath) => shouldCopyChatAppFilePath(sourceDir, filePath),
    recursive: true,
  });
  await applyChatTemplateSourceTransforms(destination);
};
const copyElectronTemplateFromRepoSource = async (
  destination: string
): Promise<void> => {
  const sourceDir = pathModule.join(getRepoRoot(), "apps", "electron");
  await cp(sourceDir, destination, {
    filter: (filePath) =>
      shouldCopyElectronFile(pathModule.relative(sourceDir, filePath)),
    recursive: true,
  });
  await applyElectronTemplateSourceTransforms(destination);
};
const normalizeChatAppFiles = async (
  destination: string,
  packageManager: PackageManager
): Promise<void> => {
  await normalizeScaffoldContent(destination);

  await replaceInFile(pathModule.join(destination, "playwright.config.ts"), [
    ['command: "bun dev"', `command: "${runScript(packageManager, "dev")}"`],
  ]);

  await replaceInFile(pathModule.join(destination, "scripts", "check-env.ts"), [
    [
      " * Run via `bun run check-env` or automatically in prebuild.",
      ` * Run via \`${runScript(packageManager, "check-env")}\` or automatically in prebuild.`,
    ],
    ["bun fetch:models", runScript(packageManager, "fetch:models")],
  ]);

  await normalizeGatewaySnapshotCommands(destination, packageManager);

  await replaceInFile(
    pathModule.join(destination, "scripts", "worktree-setup.sh"),
    [["bun i", `${packageManager} install`]]
  );

  const vercelJsonPath = pathModule.join(destination, "vercel.json");
  const vercelJson = parseJsonObject(
    await readFile(vercelJsonPath, "utf-8"),
    "Template vercel.json"
  );
  vercelJson.installCommand = `${packageManager} install`;
  vercelJson.buildCommand = runScript(packageManager, "build");
  await writeFile(
    vercelJsonPath,
    `${JSON.stringify(vercelJson, null, JSON_INDENTATION_SPACES)}\n`
  );

  if (packageManager === "pnpm") {
    await writePnpmWorkspaceConfig(destination);
  }

  await resetInstallableTools(destination);
};

const normalizeElectronFiles = async (
  destination: string,
  packageManager: PackageManager
): Promise<void> => {
  const scriptPlaceholder = `\${script}`;

  await replaceInFile(pathModule.join(destination, "forge.config.ts"), [
    [
      "Run \\`bun run prebuild\\`",
      `Run \\\`${runScript(packageManager, "prebuild")}\\\``,
    ],
    ["runBunScript", "runPackageManagerScript"],
    [
      'spawnSync("bun", ["run", script], {',
      `spawnSync("${packageManager}", ["run", script], {`,
    ],
    [
      'spawn("bun", ["run", script], {',
      `spawn("${packageManager}", ["run", script], {`,
    ],
    [
      `bun run ${scriptPlaceholder} failed`,
      `${packageManager} run ${scriptPlaceholder} failed`,
    ],
  ]);

  await replaceInFile(pathModule.join(destination, "README.md"), [
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
};
const excludeElectronFromRootTypecheck = async (
  projectDir: string
): Promise<void> => {
  const tsconfigPath = pathModule.join(projectDir, "tsconfig.json");
  const tsconfig = parseJsonObject(
    await readFile(tsconfigPath, "utf-8"),
    "Project tsconfig.json"
  );
  const exclusions = tsconfig.exclude ?? [];
  if (!isStringArray(exclusions)) {
    throw new TypeError(
      "Project tsconfig.json exclude must be an array of strings."
    );
  }
  tsconfig.exclude = [...new Set([...exclusions, "electron"])];
  await writeFile(
    tsconfigPath,
    `${JSON.stringify(tsconfig, null, JSON_INDENTATION_SPACES)}\n`
  );
};

const scaffoldFromTemplate = async (
  destination: string,
  options: {
    readonly packageManager?: PackageManager;
  } = {}
): Promise<void> => {
  const packageManager = options.packageManager ?? "bun";
  const templateDir = findTemplateDir("chat-app");

  await (typeof templateDir === "string" && templateDir !== ""
    ? cp(templateDir, destination, {
        filter: (file) => shouldCopyChatAppFilePath(templateDir, file),
        recursive: true,
      })
    : copyChatTemplateFromRepoSource(destination));

  // Packing with npm omits nested .gitignore files, so materialize the app's rules.
  await writeFile(
    pathModule.join(destination, ".gitignore"),
    "node_modules/\n.next/\n.env*\n!.env.example\n.vercel/\n.devtools/\n*.tsbuildinfo\nelectron/out/\nelectron/dist/\n"
  );
  const packageJsonPath = pathModule.join(destination, "package.json");
  const packageJson = normalizeScaffoldedPackageJson(
    parsePackageJson(await readFile(packageJsonPath, "utf-8")),
    {
      packageManager,
      template: "chat-app",
    }
  );
  await writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, JSON_INDENTATION_SPACES)}\n`
  );
  // This is a new scaffold, so remove the reference app's selection before install.
  await rm(pathModule.join(destination, "lib/ai/gateway.ts"));
  await rm(pathModule.join(destination, "lib/sandbox/adapter.ts"), {
    force: true,
  });
  await rm(pathModule.join(destination, "lib/sandbox/persistent.ts"), {
    force: true,
  });
  await writeFile(
    pathModule.join(destination, "lib/sandbox/provider.ts"),
    `import type { SandboxProvider } from "@chat-js/sandboxes/provider";

export const createSandboxProvider: (() => SandboxProvider) | undefined = undefined;
export const supportsPersistentSandbox = false;
`
  );
  await writeFile(
    pathModule.join(destination, "lib/sandbox/options.ts"),
    `import type { EnvRequirement } from "@/lib/config-requirements";

const sandboxId = "";
const sandboxEnvRequirements: EnvRequirement[] = [];
export { sandboxId, sandboxEnvRequirements };
`
  );

  const manifest = parseJsonObject(
    await readFile(packageJsonPath, "utf-8"),
    "Template package.json"
  );
  const dependencies = requireJsonObject(
    manifest.dependencies,
    "Template package.json dependencies"
  );
  delete dependencies["@ai-sdk/gateway"];
  delete dependencies["@vercel/blob"];
  delete dependencies["@tavily/core"];
  delete dependencies["@mendable/firecrawl-js"];
  await rm(pathModule.join(destination, "tools/chatjs/generate-video"), {
    force: true,
    recursive: true,
  });
  await rm(pathModule.join(destination, "tools/chatjs/generate-image"), {
    force: true,
    recursive: true,
  });
  await rm(pathModule.join(destination, "tools/chatjs/retrieve-url"), {
    force: true,
    recursive: true,
  });
  delete dependencies["@vercel/sandbox"];
  delete dependencies["browser-image-compression"];
  delete dependencies["react-dropzone"];
  await rm(pathModule.join(destination, "tools/chatjs/tavily-search"), {
    force: true,
    recursive: true,
  });
  await rm(pathModule.join(destination, "tools/chatjs/search.ts"), {
    force: true,
  });
  await rm(pathModule.join(destination, "lib/storage-provider.ts"));
  await writeFile(
    packageJsonPath,
    `${JSON.stringify(manifest, null, JSON_INDENTATION_SPACES)}\n`
  );
  const componentsPath = pathModule.join(destination, "components.json");
  const components = parseJsonObject(
    await readFile(componentsPath, "utf-8"),
    "Template components.json"
  );
  components.registries = {
    ...requireJsonObject(
      components.registries ?? {},
      "Template components.json registries"
    ),
    "@chatjs": process.env.CHATJS_REGISTRY_URL ?? registryUrl,
  };
  await writeFile(
    componentsPath,
    `${JSON.stringify(components, null, JSON_INDENTATION_SPACES)}\n`
  );
  const optionalFiles = [
    ...mcpFiles,
    "features/mcp/chatjs.json",
    ...attachmentUploadFiles,
    "features/attachment-uploads/chatjs.json",
  ];
  await Promise.all(
    optionalFiles.map(async (file): Promise<void> => {
      await rm(pathModule.join(destination, file), { force: true });
    })
  );
  const directories = new Set<string>();
  for (const file of optionalFiles) {
    let directory = pathModule.dirname(file);
    while (directory !== ".") {
      directories.add(directory);
      directory = pathModule.dirname(directory);
    }
  }
  for (const directory of [...directories].toSorted(
    (leftDirectory, rightDirectory) =>
      rightDirectory.length - leftDirectory.length
  )) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Remove children before their empty parents.
      await rmdir(pathModule.join(destination, directory));
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          ["ENOENT", "ENOTEMPTY", "EEXIST"].includes(String(error.code))
        )
      ) {
        throw error;
      }
    }
  }
  await initializeFeatureUi(destination);
  await normalizeChatAppFiles(destination, packageManager);
};

interface ElectronScaffoldOptions {
  readonly projectName: string;
  readonly packageManager?: PackageManager;
}

const scaffoldElectron = async (
  projectDir: string,
  opts: ElectronScaffoldOptions
): Promise<void> => {
  const packageManager = opts.packageManager ?? "bun";
  const rootPackageJsonPath = pathModule.join(projectDir, "package.json");
  const rootPackageJson = parseJsonObject(
    await readFile(rootPackageJsonPath, "utf-8"),
    "Project package.json"
  );
  const electronOptions: {
    packageManager: PackageManager;
    template: "electron";
    tsxVersion?: string;
  } = { packageManager, template: "electron" };
  if (
    isJsonObject(rootPackageJson.devDependencies) &&
    typeof rootPackageJson.devDependencies.tsx === "string"
  ) {
    electronOptions.tsxVersion = rootPackageJson.devDependencies.tsx;
  }
  const destination = pathModule.join(projectDir, "electron");
  const templateDir = findTemplateDir("electron");

  await (typeof templateDir === "string" && templateDir !== ""
    ? cp(templateDir, destination, {
        filter: (file) =>
          shouldCopyElectronFile(pathModule.relative(templateDir, file)),
        recursive: true,
      })
    : copyElectronTemplateFromRepoSource(destination));

  const packageJsonPath = pathModule.join(destination, "package.json");
  const packageJsonSource = await readFile(packageJsonPath, "utf-8");
  const packageJson = normalizeScaffoldedPackageJson(
    parsePackageJson(
      packageJsonSource
        .replace("__PROJECT_NAME__-electron", `${opts.projectName}-electron`)
        .replace("__GITHUB_OWNER__", "your-github-username")
        .replace("__GITHUB_REPO__", opts.projectName)
    ),
    electronOptions
  );
  await writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, JSON_INDENTATION_SPACES)}\n`
  );
  await normalizeElectronFiles(destination, packageManager);
  await excludeElectronFromRootTypecheck(projectDir);
};

const scaffoldFromGit = async (
  url: string,
  destination: string
): Promise<void> => {
  await runCommand(
    "git",
    ["clone", "--depth", "1", url, destination],
    process.cwd()
  );
  await rm(pathModule.join(destination, ".git"), {
    force: true,
    recursive: true,
  });
};
export { scaffoldElectron, scaffoldFromGit, scaffoldFromTemplate };
