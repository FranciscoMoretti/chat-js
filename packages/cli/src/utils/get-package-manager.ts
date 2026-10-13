import type { PackageManager } from "#cli/types";
import fs from "node:fs";
import path from "node:path";

const launcherPackageManager = (): PackageManager => {
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
  if (
    declared === "bun" ||
    declared === "npm" ||
    declared === "pnpm" ||
    declared === "yarn"
  ) {
    return declared;
  }
  return undefined;
};

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
      fs.existsSync(path.join(cwd, filename))
    )
  );
  return lockfile && lockfile.manager;
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
