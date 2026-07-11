import type { PackageManager } from "../types";

type DependencyMap = Record<string, string>;
type ScriptMap = Record<string, string>;

type PackageJson = {
  packageManager?: string;
  scripts?: ScriptMap;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  overrides?: Record<string, unknown>;
};

const ESBUILD_VERSION = "^0.28.0";
const BETTER_AUTH_PACKAGES = [
  "@better-auth/core",
  "@better-auth/electron",
  "better-auth",
] as const;

function toExactVersion(range: string): string {
  return range.replace(/^[~^]/, "");
}

function resolveBetterAuthVersion(packageJson: PackageJson): string | null {
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
}

function pinBetterAuthVersions(
  dependencyGroup: DependencyMap | undefined,
  version: string
): void {
  if (!dependencyGroup) {
    return;
  }

  for (const packageName of BETTER_AUTH_PACKAGES) {
    if (dependencyGroup[packageName]) {
      dependencyGroup[packageName] = version;
    }
  }
}

function normalizeChatAppScripts(scripts: ScriptMap): void {
  const defaultBranchName = "$" + "{1:-dev-local}";

  scripts.prebuild = "tsx scripts/check-env.ts";
  scripts.dev = "tsx scripts/check-env.ts && bash scripts/with-db.sh next dev";
  scripts["dev:inspect"] =
    "tsx scripts/check-env.ts && bash scripts/with-db.sh next dev --inspect";
  scripts.prod =
    "tsx scripts/check-env.ts && tsx lib/db/migrate.ts && next build && next start";
  scripts.lint = "ultracite check";
  scripts.format = "ultracite fix";
  scripts["check-env"] = "tsx scripts/check-env.ts";
  scripts["db:migrate"] =
    "export VERCEL_ENV=production && bash scripts/with-db.sh tsx lib/db/migrate.ts";
  scripts["db:backfill-parts"] = "tsx lib/db/backfill-parts.ts";
  scripts["db:branch:start"] =
    `bash -c 'N=${defaultBranchName}; bash scripts/db-branch-create.sh "$N" && bash scripts/db-branch-use.sh "$N"' --`;
  scripts["db:branch:stop"] =
    `bash -c 'N=${defaultBranchName}; bash scripts/db-branch-use.sh main && bash scripts/db-branch-delete.sh "$N"' --`;
  scripts["db:branch:list"] = "npx neonctl branches list";
  scripts.test =
    "export PLAYWRIGHT=True && playwright test --workers=4 && vitest run";
  scripts["test:e2e"] = "export PLAYWRIGHT=True && playwright test --workers=4";
  scripts["ai:devtools"] = "npx @ai-sdk/devtools";
  scripts["fetch:models"] = "tsx scripts/fetch-models.ts && ultracite fix";
}

function normalizeElectronScripts(scripts: ScriptMap): void {
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
}

function normalizeElectronDevDependencies(
  devDependencies: DependencyMap | undefined,
  tsxVersion?: string
): void {
  if (!devDependencies) {
    return;
  }

  devDependencies.esbuild = ESBUILD_VERSION;
  if (tsxVersion) {
    devDependencies.tsx = tsxVersion;
  }
}

export function normalizeScaffoldedPackageJson(
  packageJson: PackageJson,
  options?: {
    packageManager?: PackageManager;
    persistPackageManager?: boolean;
    template?: "chat-app" | "electron";
    tsxVersion?: string;
  }
): PackageJson {
  const betterAuthVersion = resolveBetterAuthVersion(packageJson);

  if (betterAuthVersion) {
    pinBetterAuthVersions(packageJson.dependencies, betterAuthVersion);
    pinBetterAuthVersions(packageJson.devDependencies, betterAuthVersion);
    packageJson.overrides = {
      ...(packageJson.overrides ?? {}),
      "@better-auth/core": betterAuthVersion,
    };
  }

  switch (options?.template) {
    case "chat-app":
      if (packageJson.scripts) {
        normalizeChatAppScripts(packageJson.scripts);
      }
      break;
    case "electron":
      if (packageJson.scripts) {
        normalizeElectronScripts(packageJson.scripts);
      }
      normalizeElectronDevDependencies(
        packageJson.devDependencies,
        options?.tsxVersion
      );
      break;
    default:
      break;
  }

  if (options?.persistPackageManager !== false) {
    const packageManager = options?.packageManager ?? "bun";
    if (packageManager !== "bun") {
      delete packageJson.packageManager;
    }
  }

  return packageJson;
}
