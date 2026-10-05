// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI inspects project files using native filesystem APIs.
import { existsSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import {
  access,
  cp,
  mkdir,
  readFile,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import pathModule from "node:path";

import { registryUrl } from "#cli/registry/shadcn";
import type { PackageManager } from "#cli/types";
import { runCommand } from "#cli/utils/run-command";
import { initializeFeatureUi } from "#cli/utils/sync-features";
import { syncTools } from "#cli/utils/sync-tools";

// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { attachmentUploadFiles } from "../../../registry/src/features/attachment-uploads";
// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { mcpFiles } from "../../../registry/src/features/mcp";
import {
  isJsonObject,
  isStringArray,
  parseJsonObject,
  requireJsonObject,
  // oxlint-disable-next-line import/max-dependencies -- Scaffold integrates filesystem transforms, registry descriptors, JSON validation, and package installation adapters.
} from "./json-object";
import { normalizeScaffoldedPackageJson } from "./package-manifest";
import { resolvePackageDirectory } from "./resolve-package-directory";
import {
  shouldCopyChatAppFile,
  shouldCopyElectronFile,
  normalizeScaffoldContent,
} from "./scaffold-content";
import { vendorPatchedPackage } from "./vendor-patched-package";

const PNPM_BUILD_SCRIPT_ALLOWLIST = [
  "cbor-extract",
  "electron",
  "electron-winstaller",
  "esbuild",
  "fs-xattr",
  "macos-alias",
  "sharp",
] as const;

/* oxlint-disable node/no-sync -- Package-root and optional-template lookup expose synchronous path results to scaffold helpers; changing these contracts requires propagating async through both lookup callers. */
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
/* oxlint-enable node/no-sync */

const getRepoRoot = (): string =>
  pathModule.resolve(getCliPackageRoot(), "../..");

/* oxlint-disable node/no-sync -- Package-root and optional-template lookup expose synchronous path results to scaffold helpers; changing these contracts requires propagating async through both lookup callers. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
const findTemplateDir = (name: string): string | null => {
  const cliRoot = getCliPackageRoot();
  const candidate = pathModule.join(cliRoot, "templates", name);
  return existsSync(candidate) ? candidate : null;
};
/* oxlint-enable unicorn/no-null */
/* oxlint-enable node/no-sync */

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

const resetInstallableTools = async (destination: string): Promise<void> => {
  const toolsDir = pathModule.join(destination, "tools", "chatjs");
  await rm(toolsDir, { force: true, recursive: true });
  await mkdir(toolsDir, { recursive: true });
  await syncTools(destination);
};

const writePnpmWorkspaceConfig = async (
  destination: string,
  options?: { readonly blockExoticSubdeps?: boolean }
): Promise<void> => {
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
    pathModule.join(destination, "pnpm-workspace.yaml"),
    `${[
      ...packageLines,
      ...pnpm10Lines,
      ...pnpm11Lines,
      ...supplyChainLines,
    ].join("\n")}\n`
  );
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
const applyChatTemplateSourceTransforms = async (
  destination: string
): Promise<void> => {
  await Promise.all(
    ["components/github-link.tsx", "components/docs-link.tsx"].map(
      async (file): Promise<void> =>
        await rm(pathModule.join(destination, file), { force: true })
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
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

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
};
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

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

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
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

  await replaceInFile(
    pathModule.join(destination, "lib", "ai", "gateways", "fallback-models.ts"),
    [["bun fetch:models", runScript(packageManager, "fetch:models")]]
  );

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
  await writeFile(vercelJsonPath, `${JSON.stringify(vercelJson, null, 2)}\n`);

  if (packageManager === "pnpm") {
    await writePnpmWorkspaceConfig(destination);
  }

  await resetInstallableTools(destination);
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */

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

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
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
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
const scaffoldFromTemplate = async (
  destination: string,
  options?: {
    readonly packageManager?: PackageManager;
  }
): Promise<void> => {
  const packageManager = options?.packageManager ?? "bun";
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
    parseJsonObject(
      await readFile(packageJsonPath, "utf-8"),
      "Template package.json"
    ),
    {
      packageManager,
      template: "chat-app",
    }
  );
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  // This is a new scaffold, so remove the reference app's selection before install.
  await rm(pathModule.join(destination, "lib/ai/gateway.ts"));
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
  await writeFile(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
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
  await writeFile(componentsPath, `${JSON.stringify(components, null, 2)}\n`);
  const optionalFiles = [
    ...mcpFiles,
    "features/mcp/chatjs.json",
    ...attachmentUploadFiles,
    "features/attachment-uploads/chatjs.json",
  ];
  await Promise.all(
    optionalFiles.map(
      async (file): Promise<void> =>
        await rm(pathModule.join(destination, file), { force: true })
    )
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
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

interface ElectronScaffoldOptions {
  readonly projectName: string;
  readonly packageManager?: PackageManager;
}

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
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
    parseJsonObject(
      packageJsonSource
        .replace("__PROJECT_NAME__-electron", `${opts.projectName}-electron`)
        .replace("__GITHUB_OWNER__", "your-github-username")
        .replace("__GITHUB_REPO__", opts.projectName),
      "Electron template package.json"
    ),
    electronOptions
  );
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  await normalizeElectronFiles(destination, packageManager);
  await excludeElectronFromRootTypecheck(projectDir);
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */

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

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
export { scaffoldElectron, scaffoldFromGit, scaffoldFromTemplate };
