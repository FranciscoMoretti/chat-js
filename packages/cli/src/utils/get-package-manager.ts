// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI inspects project files using native filesystem APIs.
import fs from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

/* oxlint-disable sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places node:path (path) before #cli/types (PackageManager); sort-imports requires the reverse. */
import type { PackageManager } from "#cli/types";
/* oxlint-enable sort-imports */

const launcherPackageManager = (): PackageManager => {
  // oxlint-disable-next-line node/no-process-env -- Read the launching package manager per call; inferPackageManager uses this current process fallback only after exhausting project manifests and lockfiles.
  const userAgent = process.env.npm_config_user_agent ?? "";
  if (userAgent.startsWith("pnpm/")) {
    return "pnpm";
  }
  if (userAgent.startsWith("yarn/")) {
    return "yarn";
  }
  if (userAgent.startsWith("npm/")) {
    return "npm";
  }
  if (userAgent.startsWith("bun/")) {
    return "bun";
  }

  return "bun";
};

/* oxlint-disable node/no-sync -- These private manifest probes preserve inferPackageManager's synchronous PackageManager API: commands/config.ts uses that value immediately to build install arguments. The paired existence check and parse keep file errors and declaration precedence unchanged. */
const readManifest = (manifestPath: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      // oxlint-disable-next-line no-undefined -- Missing or invalid package declarations return undefined; consistent-return requires a value alongside successful parsed returns.
      return undefined;
    }
    throw error;
  }
};

const readDeclaredPackageManager = (
  manifestPath: string
): PackageManager | undefined => {
  if (!fs.existsSync(manifestPath)) {
    // oxlint-disable-next-line no-undefined -- Missing or invalid package declarations return undefined; consistent-return requires a value alongside successful parsed returns.
    return undefined;
  }

  const manifest = readManifest(manifestPath);

  if (
    manifest === null ||
    typeof manifest !== "object" ||
    !("packageManager" in manifest) ||
    typeof manifest.packageManager !== "string"
  ) {
    // oxlint-disable-next-line no-undefined -- Missing or invalid package declarations return undefined; consistent-return requires a value alongside successful parsed returns.
    return undefined;
  }

  const [declared] = manifest.packageManager.split("@");
  if (
    declared === "bun" ||
    declared === "npm" ||
    declared === "pnpm" ||
    declared === "yarn"
  ) {
    return declared;
  }
  // oxlint-disable-next-line no-undefined -- Missing or invalid package declarations return undefined; consistent-return requires a value alongside successful parsed returns.
  return undefined;
};
/* oxlint-enable node/no-sync */

interface LockfileDefinition {
  readonly filenames: readonly string[];
  readonly manager: PackageManager;
}

// Preserve precedence and the short-circuit order of filesystem probes.
const LOCKFILES: readonly LockfileDefinition[] = [
  { filenames: ["pnpm-lock.yaml"], manager: "pnpm" },
  { filenames: ["yarn.lock"], manager: "yarn" },
  { filenames: ["package-lock.json"], manager: "npm" },
  { filenames: ["bun.lock", "bun.lockb"], manager: "bun" },
];

const directoryPackageManager = (cwd: string): PackageManager | undefined => {
  const declared = readDeclaredPackageManager(path.join(cwd, "package.json"));
  if (declared) {
    return declared;
  }
  const lockfile = LOCKFILES.find((candidate: LockfileDefinition): boolean =>
    candidate.filenames.some((filename): boolean =>
      // oxlint-disable-next-line node/no-sync -- inferPackageManager synchronously selects a manager before config.ts builds install command arguments; async probing would change its public PackageManager result to a Promise.
      fs.existsSync(path.join(cwd, filename))
    )
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading manager from lockfile; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  return lockfile?.manager;
};

const inferPackageManager = (cwd = process.cwd()): PackageManager => {
  let currentDir = path.resolve(cwd);
  while (true) {
    const declared = directoryPackageManager(currentDir);
    if (declared) {
      return declared;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  return launcherPackageManager();
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (inferPackageManager, launcherPackageManager); the enabled import/no-default-export convention rejects the default-export alternative. */
export { inferPackageManager, launcherPackageManager };
/* oxlint-enable import/no-named-export */
