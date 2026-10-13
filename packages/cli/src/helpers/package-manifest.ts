import { isJsonObject, parseJsonObject } from "./json-object";
import type { PackageManager } from "#cli/types";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

type DependencyMap = Record<string, string>;
type ScriptMap = Record<string, string>;

interface PackageJson {
  type?: "module" | "commonjs";
  packageManager?: string;
  scripts?: ScriptMap | null;
  dependencies?: DependencyMap | null;
  devDependencies?: DependencyMap | null;
  overrides?: Record<string, unknown> | null;
}

const isStringMap = (value: unknown): value is Record<string, string> =>
  isJsonObject(value) &&
  Object.values(value).every((entry) => typeof entry === "string");

const isPackageJson = (
  value: Readonly<Record<string, unknown>>
): value is PackageJson & Record<string, unknown> =>
  ["scripts", "dependencies", "devDependencies"].every(
    (key) =>
      value[key] === undefined || value[key] === null || isStringMap(value[key])
  ) &&
  (value.overrides === undefined ||
    value.overrides === null ||
    isJsonObject(value.overrides)) &&
  (value.packageManager === undefined ||
    typeof value.packageManager === "string") &&
  (value.type === undefined ||
    value.type === "module" ||
    value.type === "commonjs");

const parsePackageJson = (
  source: string
): PackageJson & Record<string, unknown> => {
  const value = parseJsonObject(source, "package.json");
  if (!isPackageJson(value)) {
    throw new TypeError(
      "Invalid package.json dependency, script, or package metadata fields."
    );
  }
  return value;
};

const USER_AGENT_VERSION_CAPTURE = 1;

const ESBUILD_VERSION = "^0.28.0";
const BETTER_AUTH_PACKAGES = [
  "@better-auth/core",
  "@better-auth/electron",
  "better-auth",
] as const;

const toExactVersion = (range: string): string => range.replace(/^[~^]/u, "");

const resolveBetterAuthVersion = (
  packageJson: Readonly<{
    dependencies?: Readonly<DependencyMap> | null;
    devDependencies?: Readonly<DependencyMap> | null;
  }>
): string => {
  for (const dependencyGroup of [
    packageJson.dependencies,
    packageJson.devDependencies,
  ]) {
    if (dependencyGroup) {
      for (const packageName of BETTER_AUTH_PACKAGES) {
        const version = dependencyGroup[packageName];
        if (version) {
          return toExactVersion(version);
        }
      }
    }
  }

  // The only receiver pins versions when this lookup returns a nonempty string.
  return "";
};

const pinBetterAuthVersions = (
  dependencyGroup: DependencyMap | null | undefined,
  version: string
): void => {
  if (!dependencyGroup) {
    return;
  }

  for (const packageName of BETTER_AUTH_PACKAGES) {
    if (dependencyGroup[packageName]) {
      dependencyGroup[packageName] = version;
    }
  }
};

const configureChatAppScripts = (scripts: ScriptMap): void => {
  scripts.prebuild = "tsx scripts/check-env.ts";
  scripts.dev = "tsx scripts/check-env.ts && next dev";
  scripts["dev:inspect"] = "tsx scripts/check-env.ts && next dev --inspect";
  scripts.build =
    "tsx lib/db/migrate.ts --deployment && eve build && next build";
  scripts.prod =
    "tsx scripts/check-env.ts && tsx lib/db/migrate.ts && eve build && next build && next start";
  scripts.lint = "next typegen . && ultracite check";
  scripts.format = "oxfmt --write .";
  scripts["check-env"] = "tsx scripts/check-env.ts";
  scripts["db:connect"] = "tsx scripts/check-db.ts";
  scripts["db:migrate"] = "tsx lib/db/migrate.ts";
};

const normalizeChatAppScripts = (scripts: ScriptMap): void => {
  configureChatAppScripts(scripts);
  for (const name of Object.keys(scripts)) {
    if (
      name.startsWith("db:branch:") ||
      name === "dev:neon" ||
      name === "db:migrate:neon"
    ) {
      Reflect.deleteProperty(scripts, name);
    }
  }
  scripts.test =
    "export PLAYWRIGHT=True && playwright test --workers=4 && vitest run";
  scripts["test:e2e"] = "export PLAYWRIGHT=True && playwright test --workers=4";
  scripts["ai:devtools"] = "npx @ai-sdk/devtools";
  scripts["fetch:models"] = "tsx scripts/fetch-models.ts && oxfmt --write .";
};

const configureElectronRuntimeScripts = (scripts: ScriptMap): string => {
  const build =
    "esbuild src/main.ts --bundle --platform=node --format=cjs --outfile=dist/main.js --external:electron --external:electron-updater --alias:@=.. && esbuild src/preload.ts --bundle --platform=browser --format=cjs --outfile=dist/preload.js --external:electron --alias:@=..";

  scripts.forge = "node ./scripts/run-forge.cjs";
  scripts["generate-icons"] = "tsx scripts/generate-icons.ts";
  scripts.prebuild =
    "tsx scripts/write-branding.ts && tsx scripts/generate-icons.ts";
  scripts.build = build;
  scripts.start = "node ./scripts/run-forge.cjs start";
  scripts.dev = "node ./scripts/run-forge.cjs start";
  scripts.package = "node ./scripts/run-forge.cjs package";
  scripts.make = "node ./scripts/run-forge.cjs make";
  return build;
};

const configureElectronDistributionScripts = (scripts: ScriptMap): void => {
  scripts["make:mac"] =
    "node ./scripts/run-forge.cjs make --platform=darwin --arch=universal";
  scripts["make:win"] =
    "node ./scripts/run-forge.cjs make --platform=win32 --arch=x64";
  scripts["make:linux"] =
    "node ./scripts/run-forge.cjs make --platform=linux --arch=x64";
  scripts.publish = "node ./scripts/run-forge.cjs publish";
};

const removeLegacyElectronDistributionScripts = (scripts: ScriptMap): void => {
  delete scripts["dist:mac"];
  delete scripts["dist:win"];
  delete scripts["dist:linux"];
  delete scripts["publish:mac"];
  delete scripts["publish:win"];
};

const normalizeElectronScripts = (scripts: ScriptMap): void => {
  const build = configureElectronRuntimeScripts(scripts);
  configureElectronDistributionScripts(scripts);
  scripts["electron:build"] = build;
  scripts["electron:dev"] = scripts.dev;
  scripts["electron:make"] = scripts.make;
  scripts["electron:publish"] = scripts.publish;
  removeLegacyElectronDistributionScripts(scripts);
};

const normalizeElectronDevDependencies = (
  devDependencies: DependencyMap | null | undefined,
  tsxVersion?: string
): void => {
  if (!devDependencies) {
    return;
  }

  devDependencies.esbuild = ESBUILD_VERSION;
  if (typeof tsxVersion === "string" && tsxVersion !== "") {
    devDependencies.tsx = tsxVersion;
  }
};

interface ScaffoldPackageOptions {
  readonly packageManager?: PackageManager;
  readonly persistPackageManager?: boolean;
  readonly template?: "chat-app" | "electron";
  readonly tsxVersion?: string;
}

const normalizeBetterAuthPackages = (
  packageJson: PackageJson,
  betterAuthVersion: string
): void => {
  if (typeof betterAuthVersion === "string" && betterAuthVersion !== "") {
    pinBetterAuthVersions(packageJson.dependencies, betterAuthVersion);
    pinBetterAuthVersions(packageJson.devDependencies, betterAuthVersion);
    packageJson.overrides = {
      ...packageJson.overrides,
      "@better-auth/core": betterAuthVersion,
    };
  }
};

const normalizeTemplatePackageJson = (
  packageJson: PackageJson,
  options?: ScaffoldPackageOptions
): void => {
  switch (options && options.template) {
    case "chat-app": {
      packageJson.type = "module";
      if (packageJson.scripts) {
        normalizeChatAppScripts(packageJson.scripts);
      }
      break;
    }
    case "electron": {
      if (packageJson.scripts) {
        normalizeElectronScripts(packageJson.scripts);
      }
      normalizeElectronDevDependencies(
        packageJson.devDependencies,
        options && options.tsxVersion
      );
      break;
    }
    case undefined: {
      break;
    }
    // No default
  }
};

const packageManagerVersion = (packageManager: PackageManager): string => {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const launcherVersion = (new RegExp(
    `^${packageManager}/([0-9]+\\.[0-9]+\\.[0-9]+)`,
    "u"
  ).exec(userAgent) ?? [])[USER_AGENT_VERSION_CAPTURE];
  const version =
    launcherVersion ??
    execFileSync(packageManager, ["--version"], {
      cwd: tmpdir(),
      encoding: "utf-8",
    }).trim();
  if (!/^\d+\.\d+\.\d+/u.test(version)) {
    throw new Error(`Cannot determine ${packageManager} version.`);
  }
  return version;
};

const normalizeScaffoldedPackageJson = (
  packageJson: PackageJson,
  options?: ScaffoldPackageOptions
): PackageJson => {
  const betterAuthVersion = resolveBetterAuthVersion(packageJson);
  normalizeBetterAuthPackages(packageJson, betterAuthVersion);
  normalizeTemplatePackageJson(packageJson, options);
  if ((options && options.persistPackageManager) !== false) {
    const packageManager = (options && options.packageManager) ?? "bun";
    packageJson.packageManager = `${packageManager}@${packageManagerVersion(packageManager)}`;
  }
  return packageJson;
};

export { normalizeScaffoldedPackageJson, parsePackageJson };
