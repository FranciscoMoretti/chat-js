import fs from "node:fs";
import path from "node:path";

import type { PackageManager } from "#cli/types";

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
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
const readManifest = (manifestPath: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
};

const readDeclaredPackageManager = (
  manifestPath: string
): PackageManager | undefined => {
  if (!fs.existsSync(manifestPath)) {
    return undefined;
  }

  const manifest = readManifest(manifestPath);

  if (
    manifest === null ||
    typeof manifest !== "object" ||
    !("packageManager" in manifest) ||
    typeof manifest.packageManager !== "string"
  ) {
    return undefined;
  }

  const [declared] = manifest.packageManager.split("@");
  return declared === "bun" ||
    declared === "npm" ||
    declared === "pnpm" ||
    declared === "yarn"
    ? declared
    : undefined;
};
/* oxlint-enable eslint/no-undefined */
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
export { inferPackageManager, launcherPackageManager };
