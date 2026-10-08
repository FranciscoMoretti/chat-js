// oxlint-disable-next-line import/no-nodejs-modules -- The CLI normalizer determines the selected package-manager version through its native subprocess API.
import { execFileSync } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { PackageManager } from "#cli/types";

import { isJsonObject, parseJsonObject } from "./json-object";
/* oxlint-enable sort-imports */

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

/* oxlint-disable no-undefined -- Legacy templates may omit optional maps or store null; preserve both while validating populated maps. */
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

/* oxlint-enable no-undefined */

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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This helper writes matching dependency versions into the caller-owned dependency map; readonly entries would prohibit those updates.
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This transform replaces and removes entries in the supplied scripts map before the original manifest is serialized.
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This normalizer updates the original scripts map and removes repository-only database commands before serialization.
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This transform edits the supplied scripts map in place, including Forge commands and removal of obsolete distribution aliases.
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- These platform-specific Forge commands are installed into the original scripts map.
const configureElectronDistributionScripts = (scripts: ScriptMap): void => {
  scripts["make:mac"] =
    "node ./scripts/run-forge.cjs make --platform=darwin --arch=universal";
  scripts["make:win"] =
    "node ./scripts/run-forge.cjs make --platform=win32 --arch=x64";
  scripts["make:linux"] =
    "node ./scripts/run-forge.cjs make --platform=linux --arch=x64";
  scripts.publish = "node ./scripts/run-forge.cjs publish";
};

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Remove obsolete aliases from the original caller-owned scripts map; readonly keys would prohibit deletion.
const removeLegacyElectronDistributionScripts = (scripts: ScriptMap): void => {
  delete scripts["dist:mac"];
  delete scripts["dist:win"];
  delete scripts["dist:linux"];
  delete scripts["publish:mac"];
  delete scripts["publish:win"];
};

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This normalizer updates original Electron aliases and deletes obsolete distribution aliases.
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This helper assigns esbuild and optional tsx versions into the supplied development dependency map.
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Pin matching dependency maps and replace the original manifest's overrides after resolving its version.
  packageJson: PackageJson,
  betterAuthVersion: string
): void => {
  if (typeof betterAuthVersion === "string" && betterAuthVersion !== "") {
    pinBetterAuthVersions(packageJson.dependencies, betterAuthVersion);
    pinBetterAuthVersions(packageJson.devDependencies, betterAuthVersion);
    packageJson.overrides = {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing packageJson.overrides own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...packageJson.overrides,
      "@better-auth/core": betterAuthVersion,
    };
  }
};

const normalizeTemplatePackageJson = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Apply the selected template's type, scripts, and development dependencies to the original manifest.
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
    default: {
      break;
    }
  }
};

/* oxlint-disable node/no-process-env -- Resolve the package-manager launcher version from its native environment before invoking the version command. */
/* oxlint-disable node/no-sync -- Package normalization synchronously records the selected manager's version before returning the original manifest. */
const packageManagerVersion = (packageManager: PackageManager): string => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 1 from process.env.npm_config_user_agent.match(...); read match from process.env.npm_config_user_agent; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const launcherVersion = process.env.npm_config_user_agent?.match(
    new RegExp(`^${packageManager}/([0-9]+\\.[0-9]+\\.[0-9]+)`, "u")
  )?.[USER_AGENT_VERSION_CAPTURE];
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
/* oxlint-enable node/no-sync */
/* oxlint-enable node/no-process-env */

const normalizeScaffoldedPackageJson = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This normalizer returns the original manifest after updating dependency, script, override, type, and packageManager fields; callers rely on in-place normalization.
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

// oxlint-disable-next-line import/no-named-export -- Keep the established normalizer and canonical validator named API; no-default-export rejects its default-export alternative.
export { normalizeScaffoldedPackageJson, parsePackageJson };
