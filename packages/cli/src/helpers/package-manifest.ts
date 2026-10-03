/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { execFileSync } from "node:child_process";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { PackageManager } from "../types";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

type DependencyMap = Record<string, string>;
type ScriptMap = Record<string, string>;

/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
type PackageJson = {
  type?: "module" | "commonjs";
  packageManager?: string;
  scripts?: ScriptMap;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  overrides?: Record<string, unknown>;
};
/* oxlint-enable typescript/consistent-type-definitions */

const ESBUILD_VERSION = "^0.28.0";
const BETTER_AUTH_PACKAGES = [
  "@better-auth/core",
  "@better-auth/electron",
  "better-auth",
] as const;

const toExactVersion = (range: string): string => range.replace(/^[~^]/u, "");

/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const resolveBetterAuthVersion = (packageJson: PackageJson): string | null => {
  for (const dependencyGroup of [
    packageJson.dependencies,
    packageJson.devDependencies,
  ]) {
    if (!dependencyGroup) {
      continue;
    }

    for (const packageName of BETTER_AUTH_PACKAGES) {
      const version = dependencyGroup[packageName];
      if (version) {
        return toExactVersion(version);
      }
    }
  }

  return null;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-continue */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const pinBetterAuthVersions = (
  dependencyGroup: DependencyMap | undefined,
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const normalizeChatAppScripts = (scripts: ScriptMap): void => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const normalizeElectronScripts = (scripts: ScriptMap): void => {
  const prebuild =
    "tsx scripts/write-branding.ts && tsx scripts/generate-icons.ts";
  const build =
    "esbuild src/main.ts --bundle --platform=node --format=cjs --outfile=dist/main.js --external:electron --external:electron-updater --alias:@=.. && esbuild src/preload.ts --bundle --platform=browser --format=cjs --outfile=dist/preload.js --external:electron --alias:@=..";

  scripts.forge = "node ./scripts/run-forge.cjs";
  scripts["generate-icons"] = "tsx scripts/generate-icons.ts";
  scripts.prebuild = prebuild;
  scripts.build = build;
  scripts.start = "node ./scripts/run-forge.cjs start";
  scripts.dev = "node ./scripts/run-forge.cjs start";
  scripts.package = "node ./scripts/run-forge.cjs package";
  scripts.make = "node ./scripts/run-forge.cjs make";
  scripts["make:mac"] =
    "node ./scripts/run-forge.cjs make --platform=darwin --arch=universal";
  scripts["make:win"] =
    "node ./scripts/run-forge.cjs make --platform=win32 --arch=x64";
  scripts["make:linux"] =
    "node ./scripts/run-forge.cjs make --platform=linux --arch=x64";
  scripts.publish = "node ./scripts/run-forge.cjs publish";
  scripts["electron:build"] = build;
  scripts["electron:dev"] = scripts.dev;
  scripts["electron:make"] = scripts.make;
  scripts["electron:publish"] = scripts.publish;
  delete scripts["dist:mac"];
  delete scripts["dist:win"];
  delete scripts["dist:linux"];
  delete scripts["publish:mac"];
  delete scripts["publish:win"];
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const normalizeElectronDevDependencies = (
  devDependencies: DependencyMap | undefined,
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const normalizeScaffoldedPackageJson = (
  packageJson: PackageJson,
  options?: {
    packageManager?: PackageManager;
    persistPackageManager?: boolean;
    template?: "chat-app" | "electron";
    tsxVersion?: string;
  }
): PackageJson => {
  const betterAuthVersion = resolveBetterAuthVersion(packageJson);

  if (typeof betterAuthVersion === "string" && betterAuthVersion !== "") {
    pinBetterAuthVersions(packageJson.dependencies, betterAuthVersion);
    pinBetterAuthVersions(packageJson.devDependencies, betterAuthVersion);
    packageJson.overrides = {
      ...packageJson.overrides,
      "@better-auth/core": betterAuthVersion,
    };
  }

  switch (options?.template) {
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
        options?.tsxVersion
      );
      break;
    }
    default: {
      break;
    }
  }

  if (options?.persistPackageManager !== false) {
    const packageManager = options?.packageManager ?? "bun";
    const launcherVersion = process.env.npm_config_user_agent?.match(
      new RegExp(`^${packageManager}/([0-9]+\\.[0-9]+\\.[0-9]+)`, "u")
    )?.[1];
    const version =
      launcherVersion ??
      execFileSync(packageManager, ["--version"], {
        cwd: tmpdir(),
        encoding: "utf-8",
      }).trim();
    if (!/^\d+\.\d+\.\d+/u.test(version)) {
      throw new Error(`Cannot determine ${packageManager} version.`);
    }
    packageJson.packageManager = `${packageManager}@${version}`;
  }

  return packageJson;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-process-env */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
